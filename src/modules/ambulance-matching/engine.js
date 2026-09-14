import { randomUUID as uuidv4 } from 'crypto';
import { db } from "../../shared/db/index.js";
import { logAuditEntry } from "../../shared/audit/index.js";
import {
  calculateDistanceKm,
  estimateEtaMinutes,
} from "../hospital-matching/engine.js";

export function getAllAmbulances() {
  const stmt = db.prepare(`SELECT * FROM ambulances`);
  const rows = stmt.all();
  return rows.map((r) => ({
    id: r.id,
    vehicle_number: r.vehicle_number,
    capability_tags: JSON.parse(r.capability_tags),
    current_location: JSON.parse(r.current_location),
    status: r.status,
    assigned_incident_id: r.assigned_incident_id,
    updated_at: r.updated_at,
  }));
}

export function matchBestFitAmbulance(input) {
  const ambulances = getAllAmbulances();
  const availableAmbulances = ambulances.filter(
    (a) => a.status === "available",
  );

  if (availableAmbulances.length === 0) {
    throw new Error("No ambulances currently available in coverage zone");
  }

  // Determine required capability: P1 defaults to ALS or trauma, P2 to ALS/BLS, P3/P4 to BLS
  const targetTag =
    input.required_tag || (input.priority === "P1" ? "ALS" : "BLS");

  const evaluations = [];
  const maxDist = 25;

  for (const amb of availableAmbulances) {
    const distKm = calculateDistanceKm(
      input.patient_location,
      amb.current_location,
    );
    const etaMin = estimateEtaMinutes(distKm, true);

    const hasTag = amb.capability_tags.includes(targetTag);
    const capabilityMatch = hasTag
      ? 1.0
      : amb.capability_tags.includes("ALS")
        ? 0.9
        : 0.4;

    const proximityScore = Math.max(0.1, 1 - distKm / maxDist);
    const etaScore = Math.max(0.1, 1 - etaMin / 45);

    // Weights: Capability 0.40, Proximity 0.35, ETA 0.25
    const totalScore =
      capabilityMatch * 0.4 + proximityScore * 0.35 + etaScore * 0.25;

    evaluations.push({
      id: amb.id,
      name: amb.vehicle_number,
      capability_match: Number(capabilityMatch.toFixed(2)),
      capacity_score: 1.0,
      proximity_score: Number(proximityScore.toFixed(2)),
      eta_score: Number(etaScore.toFixed(2)),
      distance_km: distKm,
      eta_minutes: etaMin,
      total_score: Number(totalScore.toFixed(3)),
      capped_due_to_missing_required_tag: !hasTag,
      missing_tags: hasTag ? [] : [targetTag],
    });
  }

  evaluations.sort((a, b) => b.total_score - a.total_score);

  const bestEval = evaluations[0];
  const selectedAmbulance = availableAmbulances.find(
    (a) => a.id === bestEval.id,
  );

  const matchId = uuidv4();
  const trace = {
    match_id: matchId,
    target_type: "ambulance",
    incident_id: input.incident_id,
    selected_id: selectedAmbulance.id,
    selected_name: selectedAmbulance.vehicle_number,
    weights: { w_cap: 0.4, w_capacity: 0.0, w_dist: 0.35, w_eta: 0.25 },
    candidate_evaluations: evaluations,
    reasoning: `Matched ambulance ${selectedAmbulance.vehicle_number} (${selectedAmbulance.capability_tags.join(", ")}) at distance ${bestEval.distance_km}km, estimated ETA ${bestEval.eta_minutes} min.`,
    timestamp: new Date().toISOString(),
  };

  // Log to AuditLog
  logAuditEntry({
    actor_user_id: input.actor_user_id || null,
    action: "match_selected",
    target_type: "AmbulanceMatch",
    target_id: matchId,
    trace_payload: trace,
  });

  // Update ambulance status
  const updateAmb = db.prepare(`
    UPDATE ambulances
    SET status = 'dispatched', assigned_incident_id = ?, updated_at = ?
    WHERE id = ?
  `);
  updateAmb.run(
    input.incident_id,
    new Date().toISOString(),
    selectedAmbulance.id,
  );

  // Update incident
  const updateInc = db.prepare(`
    UPDATE incidents
    SET matched_ambulance_id = ?, status = 'dispatched', updated_at = ?
    WHERE id = ?
  `);
  updateInc.run(
    selectedAmbulance.id,
    new Date().toISOString(),
    input.incident_id,
  );

  return { selected_ambulance: selectedAmbulance, trace };
}
