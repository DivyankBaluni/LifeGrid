import { Router, Request, Response } from 'express';
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
} from '../../modules/offline-gateway/index.js';
import { getDashboardOverview } from '../../modules/dashboard/index.js';
import { getAllAuditLogs, getAuditLogsForTarget } from '../../shared/audit/index.js';
import { authMiddleware, requirePermission, AuthenticatedRequest } from '../../shared/rbac/index.js';
import { seedDemoScenario } from '../../db/seed/demo.js';
import { Server as SocketIOServer } from 'socket.io';

export function createApiRouter(io: SocketIOServer): Router {
  const router = Router();

  // Middleware
  router.use(authMiddleware);

  // 1. INCIDENTS
  router.post('/incidents', (req: AuthenticatedRequest, res: Response) => {
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
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/incidents', (req: Request, res: Response) => {
    const incidents = getAllIncidents();
    res.json(incidents);
  });

  router.get('/incidents/:id', (req: Request, res: Response) => {
    const incident = getIncidentById(req.params.id as string);
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
  router.post('/triage', (req: AuthenticatedRequest, res: Response) => {
    try {
      const trace = evaluateTriage({
        ...req.body,
        actor_user_id: req.user?.id,
      });
      res.json(trace);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/triage/:id', (req: Request, res: Response) => {
    const trace = getTriageResultById(req.params.id as string);
    if (!trace) return res.status(404).json({ error: 'Triage result not found' });
    res.json(trace);
  });

  router.patch('/triage/:id/override', requirePermission('triage:override'), (req: AuthenticatedRequest, res: Response) => {
    try {
      const { overridden_priority, reason } = req.body;
      const updatedTrace = applyTriageOverride({
        triage_id: req.params.id as string,
        overridden_priority,
        reason,
        by_user_id: req.user?.id || 'coord-operator-01',
        by_user_name: req.user?.username || 'Control Center Operator',
      });

      io.emit('triage:override', {
        triage_id: req.params.id as string,
        updated_trace: updatedTrace,
      });

      res.json(updatedTrace);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 3. HOSPITALS & AVAILABILITY
  router.get('/hospitals', (req: Request, res: Response) => {
    const hospitals = getAllHospitals();
    res.json(hospitals);
  });

  router.get('/facilities/:id/availability', (req: Request, res: Response) => {
    const availability = getFacilityAvailability(req.params.id as string);
    if (!availability) return res.status(404).json({ error: 'Facility not found' });
    res.json(availability);
  });

  // 4. AMBULANCES
  router.get('/ambulances', (req: Request, res: Response) => {
    const ambulances = getAllAmbulances();
    res.json(ambulances);
  });

  // 5. HOSPITAL PRE-ALERTS
  router.get('/alerts/hospital/:id', (req: Request, res: Response) => {
    const alerts = getAlertsForHospital(req.params.id as string);
    res.json(alerts);
  });

  router.patch('/alerts/:id/ack', (req: AuthenticatedRequest, res: Response) => {
    try {
      const updatedAlert = acknowledgeHospitalAlert(
        req.params.id as string,
        req.user?.id || 'staff-01',
        req.body.checklist
      );

      io.emit('alert:acknowledged', updatedAlert);
      res.json(updatedAlert);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 6. REFERRALS & CONTINUITY
  router.post('/referrals', requirePermission('referral:create'), (req: AuthenticatedRequest, res: Response) => {
    try {
      const referral = createReferral({
        ...req.body,
        actor_user_id: req.user?.id,
      });

      io.emit('referral:new', referral);
      res.status(201).json(referral);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/referrals', (req: Request, res: Response) => {
    const referrals = getAllReferrals();
    res.json(referrals);
  });

  router.patch('/referrals/:id', requirePermission('referral:update'), (req: AuthenticatedRequest, res: Response) => {
    try {
      const updated = updateReferralStatus(
        req.params.id as string,
        req.body.status,
        req.user?.id
      );

      io.emit('referral:update', updated);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/followups', (req: Request, res: Response) => {
    try {
      const schedule = scheduleFollowUp(req.body);
      res.status(201).json(schedule);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 7. OFFLINE / SMS GATEWAY (Simulated endpoints for testing and demo)
  router.post('/offline/sms/inbound', (req: Request, res: Response) => {
    try {
      const result = parseInboundSMS(req.body);

      io.emit('incident:new', {
        incident: result.normalized_incident,
        triage_priority: result.triage_priority,
        channel: 'sms',
      });

      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/offline/ivr/inbound', (req: Request, res: Response) => {
    try {
      const result = parseInboundIVR(req.body);

      io.emit('incident:new', {
        incident: result.normalized_incident,
        triage_priority: result.triage_priority,
        channel: 'ivr',
      });

      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/offline/sms/outbound', (req: Request, res: Response) => {
    res.json(getOutboundSMSLog());
  });

  // 8. DASHBOARD OVERVIEW & AUDIT LOGS
  router.get('/dashboard/overview', (req: Request, res: Response) => {
    const overview = getDashboardOverview();
    res.json(overview);
  });

  router.get('/audit', (req: Request, res: Response) => {
    const logs = getAllAuditLogs(50);
    res.json(logs);
  });

  // 9. SEED / RESET DEMO SCENARIO
  router.post('/seed/demo', (req: Request, res: Response) => {
    try {
      const demoResult = seedDemoScenario();
      io.emit('dashboard:refresh');
      res.json({ message: 'Demo scenario seeded successfully', demoResult });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 10. AI / ML PREDICTIVE TRIAGE & ETA ENGINES
  router.post('/ai/triage-predict', (req: Request, res: Response) => {
    try {
      const { LifegridMLTriageClassifier } = require('../../modules/ai-engine/triage-ml.js');
      const prediction = LifegridMLTriageClassifier.predict({
        symptoms: req.body.symptoms || '',
        checklist: req.body.checklist || [],
        vitals: req.body.vitals,
        ageBand: req.body.age_band,
        patientCount: req.body.patient_count,
      });
      res.json(prediction);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/ai/predict-eta', (req: Request, res: Response) => {
    try {
      const { LifegridPredictiveETAModel } = require('../../modules/ai-engine/eta-predictor.js');
      const result = LifegridPredictiveETAModel.predictETA({
        origin: req.body.origin,
        destination: req.body.destination,
        priority: req.body.priority || 'P1',
        vehicleType: req.body.vehicle_type || 'ALS',
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 11. PAN-INDIA REGISTRY ENDPOINTS
  router.get('/pan-india/hospitals', (req: Request, res: Response) => {
    try {
      const { searchPanIndiaHospitals } = require('../../modules/pan-india/registry.js');
      const results = searchPanIndiaHospitals({
        state: req.query.state as string,
        district: req.query.district as string,
        specialty: req.query.specialty as string,
        has_icu: req.query.has_icu === 'true',
        has_emergency: req.query.has_emergency === 'true',
        search: req.query.search as string,
        lat: req.query.lat ? parseFloat(req.query.lat as string) : undefined,
        lng: req.query.lng ? parseFloat(req.query.lng as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      });
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/pan-india/ambulances', (req: Request, res: Response) => {
    try {
      const { getPanIndiaAmbulances } = require('../../modules/pan-india/registry.js');
      const results = getPanIndiaAmbulances({
        district: req.query.district as string,
        state: req.query.state as string,
        type: req.query.type as string,
      });
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 12. UTTARAKHAND DATASET & MULTI-PATIENT DISPATCH ENGINE
  router.post('/ai/multi-dispatch', async (req: Request, res: Response) => {
    try {
      const { executeMultiPatientDispatch } = require('../../modules/pan-india/uttarakhand.js');
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
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/uttarakhand/hospitals', (req: Request, res: Response) => {
    try {
      const { loadUttarakhandHospitalsFromGeoJSON } = require('../../modules/pan-india/uttarakhand.js');
      const hospitals = loadUttarakhandHospitalsFromGeoJSON();
      res.json(hospitals);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/uttarakhand/fleet', (req: Request, res: Response) => {
    try {
      const { getUttarakhandFleet } = require('../../modules/pan-india/uttarakhand.js');
      const fleet = getUttarakhandFleet();
      res.json(fleet);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
