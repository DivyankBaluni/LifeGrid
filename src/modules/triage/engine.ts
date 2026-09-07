import { v4 as uuidv4 } from 'uuid';
import { db } from '../../shared/db/index.js';
import { logAuditEntry } from '../../shared/audit/index.js';
import {
  TriagePriority,
  ExplainabilityTrace,
  SignalFired,
  ConfidenceFlags,
} from '../../shared/models/types.js';

export const RULESET_VERSION = 'lifegrid-triage-v1.2';

interface SymptomRule {
  id: string;
  keywords: string[];
  priorityCandidate: TriagePriority;
  weight: number;
  reason: string;
}

const RULES: SymptomRule[] = [
  // P1 Rules - Immediate life threats
  {
    id: 'unresponsive_unconscious',
    keywords: ['unresponsive', 'unconscious', 'passed out', 'collapsed', 'no response', 'coma'],
    priorityCandidate: 'P1',
    weight: 0.95,
    reason: 'Patient reported unresponsive or unconscious',
  },
  {
    id: 'severe_cardiac_symptoms',
    keywords: ['crushing chest pain', 'heart attack', 'cardiac', 'chest pain radiation', 'left arm pain', 'sweating chest pain', 'chest tightness'],
    priorityCandidate: 'P1',
    weight: 0.92,
    reason: 'Acute symptoms consistent with critical cardiac event',
  },
  {
    id: 'severe_respiratory_distress',
    keywords: ['cannot breathe', 'gasping', 'choking', 'cyanosis', 'blue lips', 'severe breathlessness', 'respiratory arrest'],
    priorityCandidate: 'P1',
    weight: 0.90,
    reason: 'Severe acute airway or respiratory compromise',
  },
  {
    id: 'massive_hemorrhage',
    keywords: ['severe bleeding', 'arterial bleeding', 'spurting blood', 'heavy blood loss', 'uncontrolled bleeding'],
    priorityCandidate: 'P1',
    weight: 0.88,
    reason: 'Rapid uncontrolled hemorrhage presenting shock risk',
  },
  {
    id: 'anaphylaxis_shock',
    keywords: ['anaphylaxis', 'throat swelling', 'allergic shock', 'swollen airway', 'severe allergic reaction'],
    priorityCandidate: 'P1',
    weight: 0.86,
    reason: 'Severe systemic allergic reaction with impending airway closure',
  },

  // P2 Rules - Urgent, time-sensitive
  {
    id: 'major_trauma_fracture',
    keywords: ['compound fracture', 'bone sticking out', 'severe head injury', 'car accident', 'fall from height', 'major trauma'],
    priorityCandidate: 'P2',
    weight: 0.78,
    reason: 'High-impact trauma or open fracture requiring urgent surgical care',
  },
  {
    id: 'acute_poisoning_bite',
    keywords: ['snake bite', 'poison', 'chemical ingestion', 'scorpion sting', 'insect swarm'],
    priorityCandidate: 'P2',
    weight: 0.75,
    reason: 'Suspected venomous envenomation or acute toxin exposure',
  },
  {
    id: 'moderate_respiratory_difficulty',
    keywords: ['asthma attack', 'wheezing', 'difficulty breathing', 'shortness of breath'],
    priorityCandidate: 'P2',
    weight: 0.72,
    reason: 'Acute respiratory distress without immediate airway arrest',
  },
  {
    id: 'severe_abdominal_pain',
    keywords: ['acute abdomen', 'severe stomach pain', 'rigid abdomen', 'appendicitis suspect'],
    priorityCandidate: 'P2',
    weight: 0.68,
    reason: 'Acute severe abdominal distress requiring emergency facility evaluation',
  },

  // P3 Rules - Needs care soon
  {
    id: 'closed_fracture_sprain',
    keywords: ['sprain', 'twisted ankle', 'swollen wrist', 'closed fracture', 'limb pain', 'cannot put weight'],
    priorityCandidate: 'P3',
    weight: 0.50,
    reason: 'Localized musculoskeletal injury without neurovascular deficit',
  },
  {
    id: 'persistent_gastroenteritis',
    keywords: ['vomiting', 'diarrhea', 'dehydration', 'food poisoning', 'nausea'],
    priorityCandidate: 'P3',
    weight: 0.45,
    reason: 'Persistent gastrointestinal fluid loss requiring medical evaluation',
  },
  {
    id: 'moderate_fever_pain',
    keywords: ['high fever', 'chills', 'moderate burn', 'cut needing stitches', 'laceration'],
    priorityCandidate: 'P3',
    weight: 0.42,
    reason: 'Acute condition requiring clinical intervention within hours',
  },

  // P4 Rules - Routine / Non-urgent
  {
    id: 'mild_routine_respiratory',
    keywords: ['mild cough', 'runny nose', 'cold', 'sore throat', 'sneezing', 'routine'],
    priorityCandidate: 'P4',
    weight: 0.20,
    reason: 'Mild upper respiratory symptoms appropriate for primary care or teleconsultation',
  },
  {
    id: 'chronic_care_refill',
    keywords: ['routine checkup', 'medicine refill', 'blood pressure check', 'sugar check', 'chronic follow-up'],
    priorityCandidate: 'P4',
    weight: 0.15,
    reason: 'Routine follow-up or prescription renewal suitable for PHC schedule',
  },
  {
    id: 'minor_skin_symptoms',
    keywords: ['mild rash', 'itching', 'skin allergy', 'fungal infection', 'acne'],
    priorityCandidate: 'P4',
    weight: 0.18,
    reason: 'Non-emergency dermatological complaint suitable for teleconsultation',
  },
];

export interface TriageInput {
  raw_symptoms: string;
  checklist_symptoms?: string[];
  age_band?: 'pediatric' | 'adult' | 'geriatric';
  known_conditions?: string[];
  vital_signs?: {
    spo2?: number;
    pulse?: number;
    systolic_bp?: number;
  };
  incident_id?: string;
  actor_user_id?: string | null;
}

export function evaluateTriage(input: TriageInput): ExplainabilityTrace {
  const triageId = uuidv4();
  const rawText = (input.raw_symptoms || '').toLowerCase();
  const checklist = (input.checklist_symptoms || []).map((s) => s.toLowerCase());
  const combinedText = `${rawText} ${checklist.join(' ')}`;

  const inputsUsed: string[] = [];
  const inputsMissing: string[] = [];

  if (rawText.trim()) inputsUsed.push(`free_text: "${input.raw_symptoms}"`);
  if (checklist.length > 0) inputsUsed.push(`checklist: [${input.checklist_symptoms?.join(', ')}]`);
  if (input.age_band) inputsUsed.push(`age_band: ${input.age_band}`);
  if (input.known_conditions?.length) inputsUsed.push(`known_conditions: [${input.known_conditions.join(', ')}]`);

  // Guardrail check: Incomplete input
  let incompleteInput = false;
  if (!rawText.trim() && checklist.length === 0) {
    incompleteInput = true;
    inputsMissing.push('symptoms_description');
  }

  const signalsFired: SignalFired[] = [];
  const candidatePriorities = new Set<TriagePriority>();

  for (const rule of RULES) {
    const matched = rule.keywords.some((kw) => combinedText.includes(kw.toLowerCase()));
    if (matched) {
      signalsFired.push({
        rule: rule.id,
        weight: rule.weight,
        reason: rule.reason,
      });
      candidatePriorities.add(rule.priorityCandidate);
    }
  }

  // Vital signs rule evaluations
  if (input.vital_signs) {
    inputsUsed.push(`vital_signs: ${JSON.stringify(input.vital_signs)}`);
    if (input.vital_signs.spo2 !== undefined && input.vital_signs.spo2 < 90) {
      signalsFired.push({
        rule: 'vitals_critical_hypoxia',
        weight: 0.95,
        reason: `Critically low oxygen saturation (SpO2: ${input.vital_signs.spo2}%)`,
      });
      candidatePriorities.add('P1');
    } else if (input.vital_signs.spo2 !== undefined && input.vital_signs.spo2 < 94) {
      signalsFired.push({
        rule: 'vitals_moderate_hypoxia',
        weight: 0.75,
        reason: `Moderate oxygen desaturation (SpO2: ${input.vital_signs.spo2}%)`,
      });
      candidatePriorities.add('P2');
    }
  }

  // Check for conflicting signals (e.g. routine keywords mixed with emergency flags)
  const conflictingInput = candidatePriorities.has('P1') && candidatePriorities.has('P4');

  // Fail toward caution: Highest priority candidate wins
  let priority: TriagePriority = 'P4';
  if (candidatePriorities.has('P1')) {
    priority = 'P1';
  } else if (candidatePriorities.has('P2')) {
    priority = 'P2';
  } else if (candidatePriorities.has('P3')) {
    priority = 'P3';
  } else if (signalsFired.length > 0) {
    priority = 'P4';
  } else {
    // If no specific rule matched but input was given, default conservatively to P3
    priority = incompleteInput ? 'P3' : 'P3';
    signalsFired.push({
      rule: 'unclassified_symptom_precaution',
      weight: 0.40,
      reason: 'Symptoms did not match high-risk keywords; assigned P3 precaution for clinical assessment',
    });
  }

  // Calculate score (max weight of fired signals or aggregate)
  const maxWeight = signalsFired.reduce((acc, sig) => Math.max(acc, sig.weight), 0.3);
  const score = Number(maxWeight.toFixed(2));

  // Generate plain-language explanation (CRITICAL GUARDRAIL: Never phrase as a medical diagnosis)
  let summary = '';
  if (priority === 'P1') {
    summary = `AI-suggested priority P1 (Immediate Life Threat): Emergency dispatch recommended due to critical signals (${signalsFired.map((s) => s.rule).join(', ')}).`;
  } else if (priority === 'P2') {
    summary = `AI-suggested priority P2 (Urgent Care): Urgent dispatch/facility transport recommended (${signalsFired.map((s) => s.rule).join(', ')}).`;
  } else if (priority === 'P3') {
    summary = `AI-suggested priority P3 (Prompt Clinical Care): Evaluation recommended at local health facility (${signalsFired.map((s) => s.rule).join(', ')}).`;
  } else {
    summary = `AI-suggested priority P4 (Routine Guidance): Non-emergency routine care suitable for PHC visit or teleconsultation.`;
  }

  const confidenceFlags: ConfidenceFlags = {
    incomplete_input: incompleteInput,
    conflicting_input: conflictingInput,
  };

  const trace: ExplainabilityTrace = {
    triage_id: triageId,
    rule_set_version: RULESET_VERSION,
    inputs_used: inputsUsed,
    inputs_missing: inputsMissing,
    signals_fired: signalsFired,
    score,
    priority,
    confidence_flags: confidenceFlags,
    human_reviewed: false,
    override: null,
    plain_language_summary: summary,
  };

  // Persist triage result
  const stmt = db.prepare(`
    INSERT INTO triage_results (
      id, incident_id, rule_set_version, inputs_used, inputs_missing,
      signals_fired, score, priority, confidence_flags, human_reviewed,
      override, plain_language_summary, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    triageId,
    input.incident_id || null,
    RULESET_VERSION,
    JSON.stringify(inputsUsed),
    JSON.stringify(inputsMissing),
    JSON.stringify(signalsFired),
    score,
    priority,
    JSON.stringify(confidenceFlags),
    0,
    null,
    summary,
    new Date().toISOString()
  );

  // Mandatory Guardrail: Log AI decision to AuditLog
  logAuditEntry({
    actor_user_id: input.actor_user_id || null,
    action: 'triage_generated',
    target_type: 'TriageResult',
    target_id: triageId,
    trace_payload: trace,
  });

  return trace;
}

export function getTriageResultById(triageId: string): ExplainabilityTrace | null {
  const stmt = db.prepare(`SELECT * FROM triage_results WHERE id = ?`);
  const row = stmt.get(triageId) as any;
  if (!row) return null;

  return {
    triage_id: row.id,
    rule_set_version: row.rule_set_version,
    inputs_used: JSON.parse(row.inputs_used),
    inputs_missing: JSON.parse(row.inputs_missing),
    signals_fired: JSON.parse(row.signals_fired),
    score: row.score,
    priority: row.priority as TriagePriority,
    confidence_flags: JSON.parse(row.confidence_flags),
    human_reviewed: Boolean(row.human_reviewed),
    override: row.override ? JSON.parse(row.override) : null,
    plain_language_summary: row.plain_language_summary,
  };
}
