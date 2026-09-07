"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApiRouter = createApiRouter;
const express_1 = require("express");
const index_js_1 = require("../../modules/intake/index.js");
const engine_js_1 = require("../../modules/triage/engine.js");
const override_js_1 = require("../../modules/triage/override.js");
const engine_js_2 = require("../../modules/hospital-matching/engine.js");
const engine_js_3 = require("../../modules/ambulance-matching/engine.js");
const index_js_2 = require("../../modules/referral/index.js");
const index_js_3 = require("../../modules/hospital-alerting/index.js");
const index_js_4 = require("../../modules/offline-gateway/index.js");
const index_js_5 = require("../../modules/dashboard/index.js");
const index_js_6 = require("../../shared/audit/index.js");
const index_js_7 = require("../../shared/rbac/index.js");
const demo_js_1 = require("../../db/seed/demo.js");
function createApiRouter(io) {
    const router = (0, express_1.Router)();
    // Middleware
    router.use(index_js_7.authMiddleware);
    // 1. INCIDENTS
    router.post('/incidents', (req, res) => {
        try {
            const result = (0, index_js_1.reportEmergency)({
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
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    });
    router.get('/incidents', (req, res) => {
        const incidents = (0, index_js_1.getAllIncidents)();
        res.json(incidents);
    });
    router.get('/incidents/:id', (req, res) => {
        const incident = (0, index_js_1.getIncidentById)(req.params.id);
        if (!incident)
            return res.status(404).json({ error: 'Incident not found' });
        let triageTrace = null;
        if (incident.triage_result_id) {
            triageTrace = (0, engine_js_1.getTriageResultById)(incident.triage_result_id);
        }
        const auditLogs = (0, index_js_6.getAuditLogsForTarget)('Incident', incident.id);
        res.json({
            incident,
            triage_trace: triageTrace,
            audit_logs: auditLogs,
        });
    });
    // 2. TRIAGE & OVERRIDE
    router.post('/triage', (req, res) => {
        try {
            const trace = (0, engine_js_1.evaluateTriage)({
                ...req.body,
                actor_user_id: req.user?.id,
            });
            res.json(trace);
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    });
    router.get('/triage/:id', (req, res) => {
        const trace = (0, engine_js_1.getTriageResultById)(req.params.id);
        if (!trace)
            return res.status(404).json({ error: 'Triage result not found' });
        res.json(trace);
    });
    router.patch('/triage/:id/override', (0, index_js_7.requirePermission)('triage:override'), (req, res) => {
        try {
            const { overridden_priority, reason } = req.body;
            const updatedTrace = (0, override_js_1.applyTriageOverride)({
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
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    });
    // 3. HOSPITALS & AVAILABILITY
    router.get('/hospitals', (req, res) => {
        const hospitals = (0, engine_js_2.getAllHospitals)();
        res.json(hospitals);
    });
    router.get('/facilities/:id/availability', (req, res) => {
        const availability = (0, index_js_2.getFacilityAvailability)(req.params.id);
        if (!availability)
            return res.status(404).json({ error: 'Facility not found' });
        res.json(availability);
    });
    // 4. AMBULANCES
    router.get('/ambulances', (req, res) => {
        const ambulances = (0, engine_js_3.getAllAmbulances)();
        res.json(ambulances);
    });
    // 5. HOSPITAL PRE-ALERTS
    router.get('/alerts/hospital/:id', (req, res) => {
        const alerts = (0, index_js_3.getAlertsForHospital)(req.params.id);
        res.json(alerts);
    });
    router.patch('/alerts/:id/ack', (req, res) => {
        try {
            const updatedAlert = (0, index_js_3.acknowledgeHospitalAlert)(req.params.id, req.user?.id || 'staff-01', req.body.checklist);
            io.emit('alert:acknowledged', updatedAlert);
            res.json(updatedAlert);
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    });
    // 6. REFERRALS & CONTINUITY
    router.post('/referrals', (0, index_js_7.requirePermission)('referral:create'), (req, res) => {
        try {
            const referral = (0, index_js_2.createReferral)({
                ...req.body,
                actor_user_id: req.user?.id,
            });
            io.emit('referral:new', referral);
            res.status(201).json(referral);
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    });
    router.get('/referrals', (req, res) => {
        const referrals = (0, index_js_2.getAllReferrals)();
        res.json(referrals);
    });
    router.patch('/referrals/:id', (0, index_js_7.requirePermission)('referral:update'), (req, res) => {
        try {
            const updated = (0, index_js_2.updateReferralStatus)(req.params.id, req.body.status, req.user?.id);
            io.emit('referral:update', updated);
            res.json(updated);
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    });
    router.post('/followups', (req, res) => {
        try {
            const schedule = (0, index_js_2.scheduleFollowUp)(req.body);
            res.status(201).json(schedule);
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    });
    // 7. OFFLINE / SMS GATEWAY (Simulated endpoints for testing and demo)
    router.post('/offline/sms/inbound', (req, res) => {
        try {
            const result = (0, index_js_4.parseInboundSMS)(req.body);
            io.emit('incident:new', {
                incident: result.normalized_incident,
                triage_priority: result.triage_priority,
                channel: 'sms',
            });
            res.json(result);
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    });
    router.post('/offline/ivr/inbound', (req, res) => {
        try {
            const result = (0, index_js_4.parseInboundIVR)(req.body);
            io.emit('incident:new', {
                incident: result.normalized_incident,
                triage_priority: result.triage_priority,
                channel: 'ivr',
            });
            res.json(result);
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    });
    router.get('/offline/sms/outbound', (req, res) => {
        res.json((0, index_js_4.getOutboundSMSLog)());
    });
    // 8. DASHBOARD OVERVIEW & AUDIT LOGS
    router.get('/dashboard/overview', (req, res) => {
        const overview = (0, index_js_5.getDashboardOverview)();
        res.json(overview);
    });
    router.get('/audit', (req, res) => {
        const logs = (0, index_js_6.getAllAuditLogs)(50);
        res.json(logs);
    });
    // 9. SEED / RESET DEMO SCENARIO
    router.post('/seed/demo', (req, res) => {
        try {
            const demoResult = (0, demo_js_1.seedDemoScenario)();
            io.emit('dashboard:refresh');
            res.json({ message: 'Demo scenario seeded successfully', demoResult });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // 10. AI / ML PREDICTIVE TRIAGE & ETA ENGINES
    router.post('/ai/triage-predict', (req, res) => {
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
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    });
    router.post('/ai/predict-eta', (req, res) => {
        try {
            const { LifegridPredictiveETAModel } = require('../../modules/ai-engine/eta-predictor.js');
            const result = LifegridPredictiveETAModel.predictETA({
                origin: req.body.origin,
                destination: req.body.destination,
                priority: req.body.priority || 'P1',
                vehicleType: req.body.vehicle_type || 'ALS',
            });
            res.json(result);
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    });
    // 11. PAN-INDIA REGISTRY ENDPOINTS
    router.get('/pan-india/hospitals', (req, res) => {
        try {
            const { searchPanIndiaHospitals } = require('../../modules/pan-india/registry.js');
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
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.get('/pan-india/ambulances', (req, res) => {
        try {
            const { getPanIndiaAmbulances } = require('../../modules/pan-india/registry.js');
            const results = getPanIndiaAmbulances({
                district: req.query.district,
                state: req.query.state,
                type: req.query.type,
            });
            res.json(results);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // 12. UTTARAKHAND DATASET & MULTI-PATIENT DISPATCH ENGINE
    router.post('/ai/multi-dispatch', async (req, res) => {
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
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    });
    router.get('/uttarakhand/hospitals', (req, res) => {
        try {
            const { loadUttarakhandHospitalsFromGeoJSON } = require('../../modules/pan-india/uttarakhand.js');
            const hospitals = loadUttarakhandHospitalsFromGeoJSON();
            res.json(hospitals);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.get('/uttarakhand/fleet', (req, res) => {
        try {
            const { getUttarakhandFleet } = require('../../modules/pan-india/uttarakhand.js');
            const fleet = getUttarakhandFleet();
            res.json(fleet);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    return router;
}
