import { randomUUID as uuidv4 } from 'crypto';
import { db } from '../db/index.js';

export function logAuditEntry(entry) {
  const auditId = uuidv4();
  const timestamp = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, trace_payload, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    auditId,
    entry.actor_user_id || null,
    entry.action,
    entry.target_type,
    entry.target_id,
    JSON.stringify(entry.trace_payload),
    timestamp
  );

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

export function getAuditLogsForTarget(target_type, target_id) {
  const stmt = db.prepare(`
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

export function getAllAuditLogs(limit = 100) {
  const stmt = db.prepare(`
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
