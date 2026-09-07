"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAuditEntry = logAuditEntry;
exports.getAuditLogsForTarget = getAuditLogsForTarget;
exports.getAllAuditLogs = getAllAuditLogs;
const uuid_1 = require("uuid");
const index_js_1 = require("../db/index.js");
function logAuditEntry(entry) {
    const auditId = (0, uuid_1.v4)();
    const timestamp = new Date().toISOString();
    const stmt = index_js_1.db.prepare(`
    INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, trace_payload, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
    stmt.run(auditId, entry.actor_user_id || null, entry.action, entry.target_type, entry.target_id, JSON.stringify(entry.trace_payload), timestamp);
    return {
        id: auditId,
        actor_user_id: entry.actor_user_id || null,
        action: entry.action,
        target_type: entry.target_type,
        target_id: entry.target_id,
        trace_payload: entry.trace_payload,
        timestamp,
    };
}
function getAuditLogsForTarget(target_type, target_id) {
    const stmt = index_js_1.db.prepare(`
    SELECT * FROM audit_logs
    WHERE target_type = ? AND target_id = ?
    ORDER BY timestamp DESC
  `);
    const rows = stmt.all(target_type, target_id);
    return rows.map((r) => ({
        id: r.id,
        actor_user_id: r.actor_user_id,
        action: r.action,
        target_type: r.target_type,
        target_id: r.target_id,
        trace_payload: JSON.parse(r.trace_payload),
        timestamp: r.timestamp,
    }));
}
function getAllAuditLogs(limit = 100) {
    const stmt = index_js_1.db.prepare(`
    SELECT * FROM audit_logs
    ORDER BY timestamp DESC
    LIMIT ?
  `);
    const rows = stmt.all(limit);
    return rows.map((r) => ({
        id: r.id,
        actor_user_id: r.actor_user_id,
        action: r.action,
        target_type: r.target_type,
        target_id: r.target_id,
        trace_payload: JSON.parse(r.trace_payload),
        timestamp: r.timestamp,
    }));
}
