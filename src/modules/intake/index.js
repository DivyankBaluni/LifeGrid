import { randomUUID as uuidv4 } from 'crypto';
import { db } from '../../shared/db/index.js';
import { evaluateTriage } from '../triage/engine.js';
import { matchBestFitHospital } from '../hospital-matching/engine.js';
import { matchBestFitAmbulance } from '../ambulance-matching/engine.js';
import { calculateOptimizedRoute } from '../route-optimization/engine.js';
import { createHospitalPreAlert } from '../hospital-alerting/index.js';

export function reportEmergency(input) {
  const incidentId = uuidv4();
  const now = new Date().toISOString();

  // 1. Evaluate triage via shared AI engine
  const triageResult = evaluateTriage({
    raw_symptoms: input.raw_symptoms,
    checklist_symptoms: input.checklist_symptoms,
    age_band: input.age_band,
    known_conditions: input.known_conditions,
    incident_id: incidentId,
    actor_user_id: input.reported_by || null,
  });

  // 2. Persist Incident initial state
  const stmt = db.prepare(`
    INSERT INTO incidents (
      id, reported_by, channel, location, raw_symptoms, patient_id,
      triage_result_id, status, matched_ambulance_id, matched_hospital_id,
      signal_priority_requested, drone_dispatch_logged, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
  `);

  stmt.run(
    incidentId,
    input.reported_by || null,
    input.channel || 'citizen_web',
    JSON.stringify(input.location || { latitude: 30.3398, longitude: 78.0644 }),
    input.raw_symptoms,
    input.patient_id || null,
    triageResult.triage_id,
    'triaged',
    null,
    null,
    now,
    now
  );

  let hospitalMatchResult = null;
  let ambulanceMatchResult = null;
  let routeResult = null;
  let alertResult = null;

  // 3. If Emergency path (P1, P2, P3), trigger matching & route optimization
  if (triageResult.priority === 'P1' || triageResult.priority === 'P2' || triageResult.priority === 'P3') {
    // Derive required capability tags from triage signals
    const requiredTags = [];
    const lowerSymptoms = `${input.raw_symptoms} ${(input.checklist_symptoms || []).join(' ')}`.toLowerCase();

    if (lowerSymptoms.includes('cardiac') || lowerSymptoms.includes('chest pain') || lowerSymptoms.includes('heart')) {
      requiredTags.push('cardiac');
    }
    if (lowerSymptoms.includes('trauma') || lowerSymptoms.includes('fracture') || lowerSymptoms.includes('accident')) {
      requiredTags.push('trauma');
    }
    if (lowerSymptoms.includes('bleeding') || triageResult.priority === 'P1') {
      requiredTags.push('icu');
    }

    // Match best-fit hospital ("best fit, not nearest")
    hospitalMatchResult = matchBestFitHospital({
      incident_id: incidentId,
      patient_location: input.location,
      priority: triageResult.priority,
      required_tags: requiredTags,
      actor_user_id: input.reported_by || null,
    });

    // Match best-fit ambulance
    try {
      ambulanceMatchResult = matchBestFitAmbulance({
        incident_id: incidentId,
        patient_location: input.location,
        priority: triageResult.priority,
        required_tag: triageResult.priority === 'P1' ? 'ALS' : 'BLS',
        actor_user_id: input.reported_by || null,
      });
    } catch (err) {
      console.warn('Ambulance matching warning:', err.message);
    }

    // Optimize Route
    routeResult = calculateOptimizedRoute(
      input.location,
      hospitalMatchResult.selected_hospital.location,
      triageResult.priority,
      incidentId
    );

    // Pre-alert the matched hospital
    alertResult = createHospitalPreAlert({
      incident_id: incidentId,
      hospital_id: hospitalMatchResult.selected_hospital.id,
      eta_minutes: routeResult.final_eta_minutes,
    });
  }

  // Reload the updated incident record
  const updatedIncident = getIncidentById(incidentId);

  return {
    incident: updatedIncident,
    triage: triageResult,
    hospital_match: hospitalMatchResult,
    ambulance_match: ambulanceMatchResult,
    route: routeResult,
    pre_alert: alertResult,
  };
}

export function getIncidentById(id) {
  const stmt = db.prepare(`SELECT * FROM incidents WHERE id = ?`);
  const row = stmt.get(id);
  if (!row) return null;

  return {
    id: row.id,
    reported_by: row.reported_by,
    channel: row.channel,
    location: JSON.parse(row.location),
    raw_symptoms: row.raw_symptoms,
    patient_id: row.patient_id,
    triage_result_id: row.triage_result_id,
    status: row.status,
    matched_ambulance_id: row.matched_ambulance_id,
    matched_hospital_id: row.matched_hospital_id,
    signal_priority_requested: Boolean(row.signal_priority_requested),
    drone_dispatch_logged: Boolean(row.drone_dispatch_logged),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function getAllIncidents() {
  const stmt = db.prepare(`SELECT * FROM incidents ORDER BY created_at DESC`);
  const rows = stmt.all();
  return rows.map((row) => ({
    id: row.id,
    reported_by: row.reported_by,
    channel: row.channel,
    location: JSON.parse(row.location),
    raw_symptoms: row.raw_symptoms,
    patient_id: row.patient_id,
    triage_result_id: row.triage_result_id,
    status: row.status,
    matched_ambulance_id: row.matched_ambulance_id,
    matched_hospital_id: row.matched_hospital_id,
    signal_priority_requested: Boolean(row.signal_priority_requested),
    drone_dispatch_logged: Boolean(row.drone_dispatch_logged),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}
