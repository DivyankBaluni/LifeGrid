import { v4 as uuidv4 } from 'uuid';
import { db } from '../../shared/db/index.js';
import { logAuditEntry } from '../../shared/audit/index.js';
import {
  Hospital,
  MatchExplainabilityTrace,
  TriagePriority,
  GeoPoint,
} from '../../shared/models/types.js';

export interface HospitalMatchWeights {
  w_cap: number;
  w_capacity: number;
  w_dist: number;
  w_eta: number;
}

export function getWeightsForPriority(priority: TriagePriority): HospitalMatchWeights {
  switch (priority) {
    case 'P1':
      return { w_cap: 0.50, w_eta: 0.25, w_capacity: 0.15, w_dist: 0.10 };
    case 'P2':
      return { w_cap: 0.40, w_eta: 0.25, w_capacity: 0.20, w_dist: 0.15 };
    case 'P3':
      return { w_cap: 0.30, w_capacity: 0.30, w_dist: 0.25, w_eta: 0.15 };
    case 'P4':
    default:
      return { w_cap: 0.25, w_capacity: 0.35, w_dist: 0.30, w_eta: 0.10 };
  }
}

// Haversine formula to compute great-circle distance in kilometers
export function calculateDistanceKm(from: GeoPoint, to: GeoPoint): number {
  const R = 6371; // Earth radius in km
  const dLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((from.latitude * Math.PI) / 180) *
      Math.cos((to.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

// Estimate ETA in minutes considering simulated average speed & rural road factors
export function estimateEtaMinutes(distanceKm: number, isEmergency = true): number {
  // Average rural ambulance speed ~45 km/h, routine ~35 km/h
  const speedKmH = isEmergency ? 45 : 35;
  const rawMinutes = (distanceKm / speedKmH) * 60;
  // Base dispatch latency + road curve factor
  return Math.max(2, Math.round(rawMinutes * 1.15 + 2));
}

export function getAllHospitals(): Hospital[] {
  const stmt = db.prepare(`SELECT * FROM hospitals`);
  const rows = stmt.all() as any[];

  return rows.map((r) => {
    const specStmt = db.prepare(`SELECT * FROM specialists WHERE hospital_id = ?`);
    const specs = specStmt.all(r.id) as any[];

    return {
      id: r.id,
      name: r.name,
      tier: r.tier,
      capability_tags: JSON.parse(r.capability_tags),
      bed_capacity: r.bed_capacity,
      beds_available: r.beds_available,
      specialists_on_site: specs.map((s) => ({
        id: s.id,
        hospital_id: s.hospital_id,
        name: s.name,
        specialty: s.specialty,
        available: Boolean(s.available),
      })),
      diagnostics_available: JSON.parse(r.diagnostics_available),
      medicines_available: JSON.parse(r.medicines_available),
      location: JSON.parse(r.location),
      contact_number: r.contact_number,
      accessibility_status: r.accessibility_status,
      updated_at: r.updated_at,
    };
  });
}

export interface MatchHospitalInput {
  incident_id: string;
  patient_location: GeoPoint;
  priority: TriagePriority;
  required_tags: string[];
  actor_user_id?: string | null;
}

export function matchBestFitHospital(input: MatchHospitalInput): {
  selected_hospital: Hospital;
  trace: MatchExplainabilityTrace;
} {
  const hospitals = getAllHospitals();
  if (hospitals.length === 0) {
    throw new Error('No hospitals available in registry');
  }

  const weights = getWeightsForPriority(input.priority);
  const evaluations: MatchExplainabilityTrace['candidate_evaluations'] = [];

  // Determine max distance for normalization
  const distances = hospitals.map((h) => calculateDistanceKm(input.patient_location, h.location));
  const maxDist = Math.max(...distances, 15);

  for (const hospital of hospitals) {
    const distKm = calculateDistanceKm(input.patient_location, hospital.location);
    const etaMin = estimateEtaMinutes(distKm, input.priority === 'P1' || input.priority === 'P2');

    // 1. Capability match check
    const missingTags = input.required_tags.filter(
      (tag) => !hospital.capability_tags.includes(tag.toLowerCase())
    );
    const hasSpecialistMatch = input.required_tags.some((tag) =>
      hospital.specialists_on_site.some(
        (s) => s.available && s.specialty.toLowerCase().includes(tag.toLowerCase())
      )
    );

    let capabilityMatch = 1.0;
    let cappedDueToMissingTag = false;

    if (missingTags.length > 0 && !hasSpecialistMatch) {
      // Hard cap: Hospital cannot treat the case adequately
      capabilityMatch = 0.10;
      cappedDueToMissingTag = true;
    }

    // 2. Capacity score
    const capacityScore = hospital.bed_capacity > 0
      ? Math.min(1.0, hospital.beds_available / Math.max(1, hospital.bed_capacity))
      : 0.1;

    // 3. Proximity score (normalized inverse)
    const proximityScore = Math.max(0.1, 1 - distKm / (maxDist * 1.2));

    // 4. ETA score (normalized inverse)
    const maxEta = (maxDist / 35) * 60;
    const etaScore = Math.max(0.1, 1 - etaMin / Math.max(maxEta, 60));

    // Calculate total weighted score
    let totalScore =
      capabilityMatch * weights.w_cap +
      capacityScore * weights.w_capacity +
      proximityScore * weights.w_dist +
      etaScore * weights.w_eta;

    // Strict cap enforcement: A hospital missing a vital required capability is hard capped at 0.15
    if (cappedDueToMissingTag && (input.priority === 'P1' || input.priority === 'P2')) {
      totalScore = Math.min(totalScore, 0.15);
    }

    evaluations.push({
      id: hospital.id,
      name: hospital.name,
      capability_match: Number(capabilityMatch.toFixed(2)),
      capacity_score: Number(capacityScore.toFixed(2)),
      proximity_score: Number(proximityScore.toFixed(2)),
      eta_score: Number(etaScore.toFixed(2)),
      distance_km: distKm,
      eta_minutes: etaMin,
      total_score: Number(totalScore.toFixed(3)),
      capped_due_to_missing_required_tag: cappedDueToMissingTag,
      missing_tags: missingTags,
    });
  }

  // Sort candidates by total score descending
  evaluations.sort((a, b) => b.total_score - a.total_score);

  const bestEvaluation = evaluations[0];
  const selectedHospital = hospitals.find((h) => h.id === bestEvaluation.id)!;

  const matchId = uuidv4();
  const reasoning = `Selected '${selectedHospital.name}' as best-fit with score ${bestEvaluation.total_score.toFixed(3)}. ` +
    (bestEvaluation.capped_due_to_missing_required_tag
      ? `(Warning: Critical capabilities were constrained)`
      : `Matched required capabilities [${input.required_tags.join(', ')}] with ${selectedHospital.beds_available} beds available and ${bestEvaluation.eta_minutes} min ETA.`);

  const trace: MatchExplainabilityTrace = {
    match_id: matchId,
    target_type: 'hospital',
    incident_id: input.incident_id,
    selected_id: selectedHospital.id,
    selected_name: selectedHospital.name,
    weights,
    candidate_evaluations: evaluations,
    reasoning,
    timestamp: new Date().toISOString(),
  };

  // Mandatory Guardrail: Log AI matching decision to AuditLog
  logAuditEntry({
    actor_user_id: input.actor_user_id || null,
    action: 'match_selected',
    target_type: 'HospitalMatch',
    target_id: matchId,
    trace_payload: trace,
  });

  // Update incident's matched_hospital_id if incident_id provided
  if (input.incident_id) {
    const updateStmt = db.prepare(`
      UPDATE incidents
      SET matched_hospital_id = ?, updated_at = ?
      WHERE id = ?
    `);
    updateStmt.run(selectedHospital.id, new Date().toISOString(), input.incident_id);
  }

  return { selected_hospital: selectedHospital, trace };
}
