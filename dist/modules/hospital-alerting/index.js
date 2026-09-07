"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHospitalPreAlert = createHospitalPreAlert;
exports.acknowledgeHospitalAlert = acknowledgeHospitalAlert;
exports.getAlertsForHospital = getAlertsForHospital;
const uuid_1 = require("uuid");
const index_js_1 = require("../../shared/db/index.js");
const index_js_2 = require("../../shared/audit/index.js");
function createHospitalPreAlert(input) {
    const alertId = (0, uuid_1.v4)();
    const now = new Date().toISOString();
    const emptyChecklist = {
        bed_confirmed: false,
        specialist_confirmed: false,
        equipment_confirmed: false,
        timestamps: {},
    };
    const stmt = index_js_1.db.prepare(`
    INSERT INTO hospital_alerts (
      id, incident_id, hospital_id, eta_minutes, status, readiness_checklist, created_at, acknowledged_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
    stmt.run(alertId, input.incident_id, input.hospital_id, input.eta_minutes, 'sent', JSON.stringify(emptyChecklist), now, null);
    // Update incident status to 'alerted'
    index_js_1.db.prepare(`UPDATE incidents SET status = 'alerted', updated_at = ? WHERE id = ?`).run(now, input.incident_id);
    return {
        id: alertId,
        incident_id: input.incident_id,
        hospital_id: input.hospital_id,
        eta_minutes: input.eta_minutes,
        status: 'sent',
        readiness_checklist: emptyChecklist,
        created_at: now,
        acknowledged_at: null,
    };
}
function acknowledgeHospitalAlert(alert_id, actor_user_id, checklistUpdates) {
    const stmt = index_js_1.db.prepare(`SELECT * FROM hospital_alerts WHERE id = ?`);
    const row = stmt.get(alert_id);
    if (!row) {
        throw new Error(`Alert with id ${alert_id} not found`);
    }
    const existingChecklist = JSON.parse(row.readiness_checklist);
    const now = new Date().toISOString();
    if (checklistUpdates?.bed_confirmed !== undefined) {
        existingChecklist.bed_confirmed = checklistUpdates.bed_confirmed;
        if (checklistUpdates.bed_confirmed)
            existingChecklist.timestamps.bed_confirmed_at = now;
    }
    if (checklistUpdates?.specialist_confirmed !== undefined) {
        existingChecklist.specialist_confirmed = checklistUpdates.specialist_confirmed;
        if (checklistUpdates.specialist_confirmed)
            existingChecklist.timestamps.specialist_confirmed_at = now;
    }
    if (checklistUpdates?.equipment_confirmed !== undefined) {
        existingChecklist.equipment_confirmed = checklistUpdates.equipment_confirmed;
        if (checklistUpdates.equipment_confirmed)
            existingChecklist.timestamps.equipment_confirmed_at = now;
    }
    const updateStmt = index_js_1.db.prepare(`
    UPDATE hospital_alerts
    SET status = 'acknowledged',
        readiness_checklist = ?,
        acknowledged_at = ?
    WHERE id = ?
  `);
    updateStmt.run(JSON.stringify(existingChecklist), now, alert_id);
    (0, index_js_2.logAuditEntry)({
        actor_user_id,
        action: 'alert_acknowledged',
        target_type: 'HospitalAlert',
        target_id: alert_id,
        trace_payload: {
            alert_id,
            incident_id: row.incident_id,
            hospital_id: row.hospital_id,
            checklist: existingChecklist,
            acknowledged_at: now,
        },
    });
    return {
        id: alert_id,
        incident_id: row.incident_id,
        hospital_id: row.hospital_id,
        eta_minutes: row.eta_minutes,
        status: 'acknowledged',
        readiness_checklist: existingChecklist,
        created_at: row.created_at,
        acknowledged_at: now,
    };
}
function getAlertsForHospital(hospital_id) {
    const stmt = index_js_1.db.prepare(`
    SELECT * FROM hospital_alerts
    WHERE hospital_id = ?
    ORDER BY created_at DESC
  `);
    const rows = stmt.all(hospital_id);
    return rows.map((r) => ({
        id: r.id,
        incident_id: r.incident_id,
        hospital_id: r.hospital_id,
        eta_minutes: r.eta_minutes,
        status: r.status,
        readiness_checklist: JSON.parse(r.readiness_checklist),
        created_at: r.created_at,
        acknowledged_at: r.acknowledged_at,
    }));
}
