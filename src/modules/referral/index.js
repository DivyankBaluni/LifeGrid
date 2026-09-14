import { randomUUID as uuidv4 } from 'crypto';
import { db } from '../../shared/db/index.js';
import { logAuditEntry } from '../../shared/audit/index.js';

export function createReferral(input) {
  const referralId = uuidv4();
  const now = new Date().toISOString();

  let patientId = input.patient_id;
  if (!patientId) {
    patientId = `pat-${referralId.slice(0, 8)}`;
    try {
      db.prepare(`
        INSERT OR IGNORE INTO patients (id, name, age_band, high_risk_flags, known_conditions, language_pref, created_at)
        VALUES (?, ?, 'adult', '[]', '[]', 'en', ?)
      `).run(patientId, input.patient_name || 'Anonymous Routine Patient', now);
    } catch (e) {}
  }

  const stmt = db.prepare(`
    INSERT INTO referrals (
      id, patient_id, from_facility_id, to_facility_id, reason,
      triage_result_id, status, context_payload, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    referralId,
    patientId,
    input.from_facility_id,
    input.to_facility_id,
    input.reason,
    input.triage_result_id || null,
    'initiated',
    JSON.stringify(input.context_payload || {}),
    now,
    now
  );

  logAuditEntry({
    actor_user_id: input.actor_user_id || null,
    action: 'referral_created',
    target_type: 'Referral',
    target_id: referralId,
    trace_payload: {
      referral_id: referralId,
      patient_id: input.patient_id,
      from_facility: input.from_facility_id,
      to_facility: input.to_facility_id,
      context_carried_forward: input.context_payload,
    },
  });

  return {
    id: referralId,
    patient_id: input.patient_id,
    from_facility_id: input.from_facility_id,
    to_facility_id: input.to_facility_id,
    reason: input.reason,
    triage_result_id: input.triage_result_id || null,
    status: 'initiated',
    context_payload: input.context_payload,
    created_at: now,
    updated_at: now,
  };
}

export function updateReferralStatus(referralId, status, actor_user_id) {
  const now = new Date().toISOString();
  const updateStmt = db.prepare(`
    UPDATE referrals
    SET status = ?, updated_at = ?
    WHERE id = ?
  `);
  updateStmt.run(status, now, referralId);

  const stmt = db.prepare(`SELECT * FROM referrals WHERE id = ?`);
  const row = stmt.get(referralId);
  if (!row) {
    throw new Error(`Referral with id ${referralId} not found`);
  }

  logAuditEntry({
    actor_user_id: actor_user_id || null,
    action: 'referral_created',
    target_type: 'Referral',
    target_id: referralId,
    trace_payload: {
      status_changed_to: status,
      updated_at: now,
    },
  });

  return {
    id: row.id,
    patient_id: row.patient_id,
    from_facility_id: row.from_facility_id,
    to_facility_id: row.to_facility_id,
    reason: row.reason,
    triage_result_id: row.triage_result_id,
    status: row.status,
    context_payload: JSON.parse(row.context_payload),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function getAllReferrals() {
  const stmt = db.prepare(`
    SELECT r.*, p.name as patient_name
    FROM referrals r
    LEFT JOIN patients p ON r.patient_id = p.id
    ORDER BY r.created_at DESC
  `);
  const rows = stmt.all();
  return rows.map((r) => ({
    id: r.id,
    patient_id: r.patient_id,
    patient_name: r.patient_name || 'Patient',
    from_facility_id: r.from_facility_id,
    to_facility_id: r.to_facility_id,
    reason: r.reason,
    triage_result_id: r.triage_result_id,
    status: r.status,
    context_payload: JSON.parse(r.context_payload),
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

export function getFacilityAvailability(facilityId) {
  const stmt = db.prepare(`
    SELECT id, name, diagnostics_available, medicines_available, beds_available, bed_capacity
    FROM hospitals WHERE id = ?
  `);
  const row = stmt.get(facilityId);
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    diagnostics_available: JSON.parse(row.diagnostics_available),
    medicines_available: JSON.parse(row.medicines_available),
    beds_available: row.beds_available,
    bed_capacity: row.bed_capacity,
  };
}

export function scheduleFollowUp(input) {
  const id = uuidv4();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO follow_up_schedules (id, patient_id, due_date, reason, facility_id, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, input.patient_id, input.due_date, input.reason, input.facility_id, 'pending', now);

  return {
    id,
    patient_id: input.patient_id,
    due_date: input.due_date,
    reason: input.reason,
    facility_id: input.facility_id,
    status: 'pending',
    created_at: now,
  };
}

export function getFollowUpsForPatient(patientId) {
  const stmt = db.prepare(`
    SELECT * FROM follow_up_schedules WHERE patient_id = ? ORDER BY due_date ASC
  `);
  return stmt.all(patientId);
}
