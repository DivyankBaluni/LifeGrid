import { Router } from 'express';
import { reportEmergency, getAllIncidents, getIncidentById } from '../../modules/intake/index.js';
import { evaluateTriage, getTriageResultById } from '../../modules/triage/engine.js';
import { applyTriageOverride } from '../../modules/triage/override.js';
import { getAllHospitals } from '../../modules/hospital-matching/engine.js';
import { getAllAmbulances } from '../../modules/ambulance-matching/engine.js';
import {
  createReferral,
  getAllReferrals,
  updateReferralStatus,
  getFacilityAvailability,
  scheduleFollowUp,
} from '../../modules/referral/index.js';
import {
  acknowledgeHospitalAlert,
  getAlertsForHospital,
} from '../../modules/hospital-alerting/index.js';
import {
  parseInboundSMS,
  parseInboundIVR,
  getOutboundSMSLog,
  getGatewayConfig,
  updateGatewayConfig,
  sendDirectSMS,
} from '../../modules/offline-gateway/index.js';
import { getDashboardOverview } from '../../modules/dashboard/index.js';
import { getAllAuditLogs, getAuditLogsForTarget } from '../../shared/audit/index.js';
import { authMiddleware, requirePermission } from '../../shared/rbac/index.js';
import { seedDemoScenario } from '../../db/seed/demo.js';
import { LifegridMLTriageClassifier } from '../../modules/ai-engine/triage-ml.js';
import { LifegridPredictiveETAModel } from '../../modules/ai-engine/eta-predictor.js';
import { searchPanIndiaHospitals, getPanIndiaAmbulances } from '../../modules/pan-india/registry.js';
import {
  executeMultiPatientDispatch,
  loadUttarakhandHospitalsFromGeoJSON,
  getUttarakhandFleet,
} from '../../modules/pan-india/uttarakhand.js';

export function createApiRouter(io) {
  const router = Router();

  // Middleware
  router.use(authMiddleware);

  // 1. INCIDENTS
  router.post('/incidents', (req, res) => {
    try {
      const result = reportEmergency({
        ...req.body,
        reported_by: req.user?.id || req.body.reported_by,
      });

      // Broadcast to all connected control-center clients
      io.emit('incident:new', {
        incident: result.incident,
        triage: result.triage,
        hospital: result.hospital_match?.selected_hospital,
        ambulance: result.ambulance_match?.selected_ambulance,
      });

      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/incidents', (req, res) => {
    const incidents = getAllIncidents();
    res.json(incidents);
  });

  router.get('/incidents/:id', (req, res) => {
    const incident = getIncidentById(req.params.id);
    if (!incident) return res.status(404).json({ error: 'Incident not found' });

    let triageTrace = null;
    if (incident.triage_result_id) {
      triageTrace = getTriageResultById(incident.triage_result_id);
    }

    const auditLogs = getAuditLogsForTarget('Incident', incident.id);

    res.json({
      incident,
      triage_trace: triageTrace,
      audit_logs: auditLogs,
    });
  });

  // 2. TRIAGE & OVERRIDE
  router.post('/triage', (req, res) => {
    try {
      const trace = evaluateTriage({
        ...req.body,
        actor_user_id: req.user?.id,
      });
      res.json(trace);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/triage/:id', (req, res) => {
    const trace = getTriageResultById(req.params.id);
    if (!trace) return res.status(404).json({ error: 'Triage result not found' });
    res.json(trace);
  });

  router.patch('/triage/:id/override', requirePermission('triage:override'), (req, res) => {
    try {
      const { overridden_priority, reason } = req.body;
      const updatedTrace = applyTriageOverride({
        triage_id: req.params.id,
        overridden_priority,
        reason,
        by_user_id: req.user?.id || 'coord-operator-01',
        by_user_name: req.user?.username || 'Control Center Operator',
      });

      io.emit('triage:override', {
        triage_id: req.params.id,
        updated_trace: updatedTrace,
      });

      res.json(updatedTrace);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // 3. HOSPITALS & AVAILABILITY
  router.get('/hospitals', (req, res) => {
    const hospitals = getAllHospitals();
    res.json(hospitals);
  });

  router.get('/facilities/:id/availability', (req, res) => {
    const availability = getFacilityAvailability(req.params.id);
    if (!availability) return res.status(404).json({ error: 'Facility not found' });
    res.json(availability);
  });

  // 4. AMBULANCES
  router.get('/ambulances', (req, res) => {
    const ambulances = getAllAmbulances();
    res.json(ambulances);
  });

  // 5. HOSPITAL PRE-ALERTS
  router.get('/alerts/hospital/:id', (req, res) => {
    const alerts = getAlertsForHospital(req.params.id);
    res.json(alerts);
  });

  router.patch('/alerts/:id/ack', (req, res) => {
    try {
      const updatedAlert = acknowledgeHospitalAlert(
        req.params.id,
        req.user?.id || 'staff-01',
        req.body.checklist
      );

      io.emit('alert:acknowledged', updatedAlert);
      res.json(updatedAlert);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // 6. REFERRALS & CONTINUITY
  router.post('/referrals', requirePermission('referral:create'), (req, res) => {
    try {
      const referral = createReferral({
        ...req.body,
        actor_user_id: req.user?.id,
      });

      io.emit('referral:new', referral);
      res.status(201).json(referral);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/referrals', (req, res) => {
    const referrals = getAllReferrals();
    res.json(referrals);
  });

  router.patch('/referrals/:id', requirePermission('referral:update'), (req, res) => {
    try {
      const updated = updateReferralStatus(
        req.params.id,
        req.body.status,
        req.user?.id
      );

      io.emit('referral:update', updated);
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/followups', (req, res) => {
    try {
      const schedule = scheduleFollowUp(req.body);
      res.status(201).json(schedule);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // 7. OFFLINE / SMS GATEWAY (Simulated endpoints for testing and demo)
  router.post('/offline/sms/inbound', (req, res) => {
    try {
      const result = parseInboundSMS(req.body);

      io.emit('incident:new', {
        incident: result.normalized_incident,
        triage_priority: result.triage_priority,
        channel: 'sms',
      });

      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/offline/ivr/inbound', (req, res) => {
    try {
      const result = parseInboundIVR(req.body);

      io.emit('incident:new', {
        incident: result.normalized_incident,
        triage_priority: result.triage_priority,
        channel: 'ivr',
      });

      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/offline/sms/outbound', (req, res) => {
    res.json(getOutboundSMSLog());
  });

  router.get('/offline/config', (req, res) => {
    res.json(getGatewayConfig());
  });

  router.post('/offline/config', (req, res) => {
    res.json(updateGatewayConfig(req.body));
  });

  router.post('/offline/sms/send', (req, res) => {
    const { to, body } = req.body;
    if (!to || !body) return res.status(400).json({ error: 'Missing to or body' });
    const result = sendDirectSMS(to, body);
    res.json(result);
  });

  // 8. DASHBOARD OVERVIEW & AUDIT LOGS
  router.get('/dashboard/overview', (req, res) => {
    const overview = getDashboardOverview();
    res.json(overview);
  });

  router.get('/audit', (req, res) => {
    const logs = getAllAuditLogs(50);
    res.json(logs);
  });

  // 9. SEED / RESET DEMO SCENARIO
  router.post('/seed/demo', (req, res) => {
    try {
      const demoResult = seedDemoScenario();
      io.emit('dashboard:refresh');
      res.json({ message: 'Demo scenario seeded successfully', demoResult });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 10. AI / ML PREDICTIVE TRIAGE & ETA ENGINES
  router.post('/ai/triage-predict', (req, res) => {
    try {
      const prediction = LifegridMLTriageClassifier.predict({
        symptoms: req.body.symptoms || '',
        checklist: req.body.checklist || [],
        vitals: req.body.vitals,
        ageBand: req.body.age_band,
        patientCount: req.body.patient_count,
      });
      res.json(prediction);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/ai/predict-eta', (req, res) => {
    try {
      const result = LifegridPredictiveETAModel.predictETA({
        origin: req.body.origin,
        destination: req.body.destination,
        priority: req.body.priority || 'P1',
        vehicleType: req.body.vehicle_type || 'ALS',
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // 11. PAN-INDIA REGISTRY ENDPOINTS
  router.get('/pan-india/hospitals', (req, res) => {
    try {
      const results = searchPanIndiaHospitals({
        state: req.query.state,
        district: req.query.district,
        specialty: req.query.specialty,
        has_icu: req.query.has_icu === 'true',
        has_emergency: req.query.has_emergency === 'true',
        search: req.query.search,
        lat: req.query.lat ? parseFloat(req.query.lat) : undefined,
        lng: req.query.lng ? parseFloat(req.query.lng) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit) : 50,
      });
      res.json(results);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/pan-india/ambulances', (req, res) => {
    try {
      const results = getPanIndiaAmbulances({
        district: req.query.district,
        state: req.query.state,
        type: req.query.type,
      });
      res.json(results);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 12. UTTARAKHAND DATASET & MULTI-PATIENT DISPATCH ENGINE
  router.post('/ai/multi-dispatch', async (req, res) => {
    try {
      const result = await executeMultiPatientDispatch({
        incident_id: req.body.incident_id,
        incident_location: req.body.incident_location || { latitude: 30.3165, longitude: 78.0322 },
        patient_count: req.body.patient_count || 1,
        chief_complaint: req.body.chief_complaint || 'Multi-casualty road traffic collision',
        custom_patients: req.body.custom_patients,
      });

      // Broadcast multi-ambulance alert to control-center
      io.emit('incident:multi_dispatch', result);

      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/uttarakhand/hospitals', (req, res) => {
    try {
      const hospitals = loadUttarakhandHospitalsFromGeoJSON();
      res.json(hospitals);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/uttarakhand/fleet', (req, res) => {
    try {
      const fleet = getUttarakhandFleet();
      res.json(fleet);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
