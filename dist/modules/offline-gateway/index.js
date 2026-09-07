"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOutboundSMSLog = getOutboundSMSLog;
exports.logOutboundSMS = logOutboundSMS;
exports.parseInboundSMS = parseInboundSMS;
exports.parseInboundIVR = parseInboundIVR;
exports.renderHospitalPreAlertSMS = renderHospitalPreAlertSMS;
exports.renderReferralReminderSMS = renderReferralReminderSMS;
const index_js_1 = require("../intake/index.js");
// In-memory buffer of outbound simulated SMS messages
const outboundSMSLog = [];
function getOutboundSMSLog() {
    return [...outboundSMSLog];
}
function logOutboundSMS(to, body, type) {
    const msg = {
        to,
        body,
        timestamp: new Date().toISOString(),
        type,
    };
    outboundSMSLog.unshift(msg);
    console.log(`[SMS OUTBOUND TO ${to}]: ${body}`);
    return msg;
}
// Parse inbound SMS keywords into standard intake payload
// Format: "EMRG <SYMPTOMS> [LOC:<LAT,LON> or <VILLAGE>]"
function parseInboundSMS(payload) {
    const text = payload.body.trim();
    let location = {
        latitude: 19.8762,
        longitude: 75.3433,
        address: 'Rural Cell Tower Coverage Zone',
    };
    let rawSymptoms = text;
    // Extract location tag if provided
    const locMatch = text.match(/LOC:([^\s]+)/i);
    if (locMatch) {
        const locStr = locMatch[1];
        if (locStr.includes(',')) {
            const [lat, lon] = locStr.split(',').map(Number);
            if (!isNaN(lat) && !isNaN(lon)) {
                location = { latitude: lat, longitude: lon, address: 'SMS Coordinate Beacon' };
            }
        }
        else {
            location.address = `Village ${locStr.replace(/_/g, ' ')}`;
        }
        rawSymptoms = text.replace(locMatch[0], '').replace(/^EMRG/i, '').trim();
    }
    else {
        rawSymptoms = text.replace(/^EMRG/i, '').trim();
    }
    if (!rawSymptoms) {
        rawSymptoms = 'Emergency reported via SMS without symptom details';
    }
    // Feed into standard pipeline
    const result = (0, index_js_1.reportEmergency)({
        reported_by: `sms:${payload.from}`,
        channel: 'sms',
        location,
        raw_symptoms: rawSymptoms,
    });
    // Render outbound plain-text SMS confirmation back to reporter
    const replyText = `[LIFEGRID ALERT] Emergency report #${result.incident.id.slice(0, 6)} received. Priority: ${result.triage.priority}. Best-fit facility: ${result.hospital_match?.selected_hospital?.name || 'Assigned'}. Ambulance dispatched: ${result.ambulance_match?.selected_ambulance?.vehicle_number || 'En route'}. ETA: ${result.route?.final_eta_minutes || '10'}m.`;
    logOutboundSMS(payload.from, replyText, 'status_update');
    return {
        normalized_incident: result.incident,
        triage_priority: result.triage.priority,
        outbound_reply_sms: replyText,
        full_result: result,
    };
}
// Parse inbound IVR numeric menu into standard intake payload
function parseInboundIVR(payload) {
    let symptoms = 'Emergency reported via IVR';
    let checklist = [];
    switch (payload.keypad_digits.trim()) {
        case '1':
            symptoms = 'Critical chest pain, suspected acute cardiac event reported via IVR';
            checklist = ['crushing chest pain', 'cardiac'];
            break;
        case '2':
            symptoms = 'Severe road accident / trauma injury reported via IVR';
            checklist = ['major trauma', 'severe bleeding'];
            break;
        case '3':
            symptoms = 'Severe respiratory gasping / breathing compromise reported via IVR';
            checklist = ['cannot breathe'];
            break;
        default:
            symptoms = 'General rural medical emergency assistance requested via IVR';
            break;
    }
    const location = payload.cell_tower_loc || {
        latitude: 19.8762,
        longitude: 75.3433,
        address: 'Automated Cell Tower Triangulation',
    };
    const result = (0, index_js_1.reportEmergency)({
        reported_by: `ivr:${payload.caller_number}`,
        channel: 'ivr',
        location,
        raw_symptoms: symptoms,
        checklist_symptoms: checklist,
    });
    const replyText = `[LIFEGRID IVR DISPATCH] Audio menu selection (${payload.keypad_digits}) processed. Priority: ${result.triage.priority}. Dispatching nearest emergency responder.`;
    logOutboundSMS(payload.caller_number, replyText, 'status_update');
    return {
        normalized_incident: result.incident,
        triage_priority: result.triage.priority,
        outbound_reply_sms: replyText,
        full_result: result,
    };
}
// Outbound SMS template renderers for hospitals and health workers
function renderHospitalPreAlertSMS(hospitalContact, incident, priority, etaMinutes) {
    const body = `[LIFEGRID PRE-ALERT] INCOMING PRIORITY: ${priority}. ETA: ~${etaMinutes} MIN. Symptoms: ${incident.raw_symptoms.slice(0, 60)}. Please confirm bed & specialist readiness. Reply READY to acknowledge.`;
    logOutboundSMS(hospitalContact, body, 'pre_alert');
    return body;
}
function renderReferralReminderSMS(patientContact, patientName, targetFacilityName, dueDate) {
    const body = `[LIFEGRID CARE] Namaste ${patientName}. Your scheduled clinical follow-up at ${targetFacilityName} is on ${dueDate}. Please bring your LifeGrid digital referral card.`;
    logOutboundSMS(patientContact, body, 'referral_reminder');
    return body;
}
