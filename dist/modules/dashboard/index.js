"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardOverview = getDashboardOverview;
const index_js_1 = require("../intake/index.js");
const engine_js_1 = require("../hospital-matching/engine.js");
const engine_js_2 = require("../ambulance-matching/engine.js");
const index_js_2 = require("../referral/index.js");
const index_js_3 = require("../../shared/audit/index.js");
const index_js_4 = require("../offline-gateway/index.js");
function getDashboardOverview() {
    const incidents = (0, index_js_1.getAllIncidents)();
    const hospitals = (0, engine_js_1.getAllHospitals)();
    const ambulances = (0, engine_js_2.getAllAmbulances)();
    const referrals = (0, index_js_2.getAllReferrals)();
    const recentAudit = (0, index_js_3.getAllAuditLogs)(15);
    const smsLogs = (0, index_js_4.getOutboundSMSLog)().slice(0, 10);
    // Compute live metrics
    const activeEmergencies = incidents.filter((i) => i.status !== 'resolved' && i.status !== 'cancelled');
    const p1Count = incidents.filter((i) => i.status !== 'resolved').length;
    const availableAmbulances = ambulances.filter((a) => a.status === 'available').length;
    const inTransitReferrals = referrals.filter((r) => r.status === 'in_transit' || r.status === 'initiated').length;
    return {
        metrics: {
            total_incidents: incidents.length,
            active_emergencies: activeEmergencies.length,
            available_ambulances: availableAmbulances,
            total_ambulances: ambulances.length,
            referrals_in_transit: inTransitReferrals,
            facilities_monitored: hospitals.length,
        },
        incidents,
        hospitals,
        ambulances,
        referrals,
        recent_audit_logs: recentAudit,
        recent_sms_logs: smsLogs,
    };
}
