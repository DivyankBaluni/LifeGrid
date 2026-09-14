import assert from 'assert';
import { evaluateTriage } from '../src/modules/triage/engine.js';
import { applyTriageOverride } from '../src/modules/triage/override.js';
import { matchBestFitHospital } from '../src/modules/hospital-matching/engine.js';
import { parseInboundSMS } from '../src/modules/offline-gateway/index.js';
import { getAuditLogsForTarget } from '../src/shared/audit/index.js';
import { seedDemoScenario } from '../src/db/seed/demo.js';

console.log('=== Starting LIFEGRID Automated Verification Suite ===\n');

// 0. Seed fresh state
seedDemoScenario();

// Test 1: Triage classifies P1 for cardiac symptoms & produces explainability trace
console.log('Test 1: P1 Cardiac Triage & Explainability Trace');
const cardiacTriage = evaluateTriage({
  raw_symptoms: 'Patient has crushing chest pain and breathlessness',
  checklist_symptoms: ['crushing chest pain'],
});
assert.strictEqual(cardiacTriage.priority, 'P1', 'Must be classified as P1');
assert(cardiacTriage.score >= 0.9, 'P1 score must be high');
assert(cardiacTriage.signals_fired.length > 0, 'Signals must have fired');
assert(cardiacTriage.plain_language_summary.includes('AI-suggested priority'), 'Must contain AI-suggested priority');
assert(!cardiacTriage.plain_language_summary.toLowerCase().includes('diagnosis'), 'Guardrail violation: Must NEVER use the word diagnosis');
console.log('✔ Passed: Triage classified P1 and preserved guardrails\n');

// Test 2: Incomplete input detection
console.log('Test 2: Incomplete Input Detection');
const emptyTriage = evaluateTriage({
  raw_symptoms: '',
  checklist_symptoms: [],
});
assert.strictEqual(emptyTriage.confidence_flags.incomplete_input, true, 'incomplete_input must be true when symptoms missing');
assert(emptyTriage.inputs_missing.includes('symptoms_description'), 'symptoms_description must be in missing inputs');
console.log('✔ Passed: Incomplete input properly flagged without false certainty\n');

// Test 3: Hospital A vs Hospital B matching logic ("best fit, not nearest")
console.log('Test 3: Hospital A vs Hospital B Worked Example');
const matchResult = matchBestFitHospital({
  incident_id: 'test-incident-cardiac',
  patient_location: { latitude: 19.8762, longitude: 75.3433 },
  priority: 'P1',
  required_tags: ['cardiac', 'icu'],
});
assert.strictEqual(
  matchResult.selected_hospital.id,
  'hosp-b-district',
  'Hospital B must win because Hospital A lacks cardiac capability'
);
const hospAEval = matchResult.trace.candidate_evaluations.find((c) => c.id === 'hosp-a-local');
const hospBEval = matchResult.trace.candidate_evaluations.find((c) => c.id === 'hosp-b-district');
assert.strictEqual(hospAEval.capped_due_to_missing_required_tag, true, 'Hospital A must be capped due to missing tag');
assert(hospBEval.total_score > hospAEval.total_score, 'Hospital B score must exceed Hospital A');
console.log(`✔ Passed: Hospital B (${hospBEval.total_score}) won over Hospital A (${hospAEval.total_score})\n`);

// Test 4: Human Override with mandatory clinical reason & append-only audit
console.log('Test 4: Human Override & Audit Integrity');
const overrideResult = applyTriageOverride({
  triage_id: cardiacTriage.triage_id,
  overridden_priority: 'P2',
  reason: 'Patient stabilized by on-scene paramedic with sublingual nitroglycerin, BP normalized',
  by_user_id: 'usr-paramedic-01',
});
assert.strictEqual(overrideResult.human_reviewed, true, 'human_reviewed flag must be set');
assert.strictEqual(overrideResult.override?.overridden_priority, 'P2', 'Priority must be updated');
const auditLogs = getAuditLogsForTarget('TriageResult', cardiacTriage.triage_id);
assert(auditLogs.length >= 2, 'AuditLog must contain initial triage_generated AND override_applied');
console.log('✔ Passed: Override successfully recorded in immutable AuditLog\n');

// Test 5: Low-connectivity SMS Intake & plain-text template response
console.log('Test 5: SMS Offline Fallback Intake');
const smsResult = parseInboundSMS({
  from: '+919999988888',
  body: 'EMRG compound fracture LOC:19.88,75.34',
});
assert(smsResult.normalized_incident.id, 'Must produce valid normalized incident');
assert(smsResult.outbound_reply_sms.startsWith('[LIFEGRID ALERT]'), 'Must produce plain-text SMS alert');
console.log('✔ Passed: Inbound SMS normalized and outbound template generated\n');

console.log('=====================================================');
console.log('   ALL VERIFICATION TESTS PASSED SUCCESSFULLY!       ');
console.log('=====================================================\n');
