import { v4 as uuidv4 } from 'uuid';
import { db } from '../../shared/db/index.js';
import { logAuditEntry } from '../../shared/audit/index.js';
import {
  Referral,
  ReferralStatus,
  ReferralContextPayload,
  FollowUpSchedule,
  TriagePriority,
} from '../../shared/models/types.js';

export function createReferral(input: {
  patient_id: string;
  from_facility_id: string;
  to_facility_id: string;
  reason: string;
  triage_result_id?: string | null;
  context_payload: ReferralContextPayload;
  actor_user_id?: string | null;
}): Referral {
  const referralId = uuidv4();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO referrals (
      id, patient_id, from_facility_id, to_facility_id, reason,
      triage_result_id, status, context_payload, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    referralId,
    input.patient_id,
    input.from_facility_id,
    input.to_facility_id,
    input.reason,
    input.triage_result_id || null,
    'initiated',
    JSON.stringify(input.context_payload),
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

export function updateReferralStatus(
  referralId: string,
  status: ReferralStatus,
  actor_user_id?: string | null
): Referral {
  const now = new Date().toISOString();
  const updateStmt = db.prepare(`
    UPDATE referrals
    SET status = ?, updated_at = ?
    WHERE id = ?
  `);
  updateStmt.run(status, now, referralId);

  const stmt = db.prepare(`SELECT * FROM referrals WHERE id = ?`);
  const row = stmt.get(referralId) as any;
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
    status: row.status as ReferralStatus,
    context_payload: JSON.parse(row.context_payload),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function getAllReferrals(): Referral[] {
  const stmt = db.prepare(`
    SELECT r.*, p.name as patient_name
    FROM referrals r
    LEFT JOIN patients p ON r.patient_id = p.id
    ORDER BY r.created_at DESC
  `);
  const rows = stmt.all() as any[];
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

export function getFacilityAvailability(facilityId: string): {
  id: string;
  name: string;
  diagnostics_available: string[];
  medicines_available: string[];
  beds_available: number;
  bed_capacity: number;
} | null {
  const stmt = db.prepare(`
    SELECT id, name, diagnostics_available, medicines_available, beds_available, bed_capacity
    FROM hospitals WHERE id = ?
  `);
  const row = stmt.get(facilityId) as any;
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

export function scheduleFollowUp(input: {
  patient_id: string;
  due_date: string;
  reason: string;
  facility_id: string;
}): FollowUpSchedule {
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

export function getFollowUpsForPatient(patientId: string): FollowUpSchedule[] {
  const stmt = db.prepare(`
    SELECT * FROM follow_up_schedules WHERE patient_id = ? ORDER BY due_date ASC
  `);
  return stmt.all(patientId) as FollowUpSchedule[];
}
