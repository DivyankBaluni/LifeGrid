import { db } from '../../shared/db/index.js';
import { logAuditEntry } from '../../shared/audit/index.js';
import {
  TriagePriority,
  HumanOverride,
  ExplainabilityTrace,
} from '../../shared/models/types.js';
import { getTriageResultById } from './engine.js';

export interface OverrideInput {
  triage_id: string;
  overridden_priority: TriagePriority;
  reason: string;
  by_user_id: string;
  by_user_name?: string;
}

export function applyTriageOverride(input: OverrideInput): ExplainabilityTrace {
  if (!input.reason || input.reason.trim().length < 3) {
    throw new Error('Override requires a non-empty clinical rationale (reason)');
  }

  const existingTrace = getTriageResultById(input.triage_id);
  if (!existingTrace) {
    throw new Error(`Triage result with id ${input.triage_id} not found`);
  }

  const overrideData: HumanOverride = {
    overridden_priority: input.overridden_priority,
    reason: input.reason.trim(),
    by_user_id: input.by_user_id,
    by_user_name: input.by_user_name || 'Healthcare Coordinator',
    timestamp: new Date().toISOString(),
  };

  // Update triage_results record marking human_reviewed=1 and appending override info
  const updateStmt = db.prepare(`
    UPDATE triage_results
    SET human_reviewed = 1,
        override = ?
    WHERE id = ?
  `);
  updateStmt.run(JSON.stringify(overrideData), input.triage_id);

  // If there's an associated incident, update its status or priority reference if needed
  const incidentStmt = db.prepare(`
    UPDATE incidents
    SET updated_at = ?
    WHERE triage_result_id = ?
  `);
  incidentStmt.run(new Date().toISOString(), input.triage_id);

  // Log override to AuditLog (Mandatory Guardrail)
  logAuditEntry({
    actor_user_id: input.by_user_id,
    action: 'override_applied',
    target_type: 'TriageResult',
    target_id: input.triage_id,
    trace_payload: {
      original_trace: existingTrace,
      override: overrideData,
      note: `Triage priority overridden from ${existingTrace.priority} to ${input.overridden_priority}`,
    },
  });

  return {
    ...existingTrace,
    human_reviewed: true,
    override: overrideData,
  };
}
