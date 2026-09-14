import { db } from '../../shared/db/index.js';
import { logAuditEntry } from '../../shared/audit/index.js';
import { calculateDistanceKm } from '../hospital-matching/engine.js';

// Static congestion model by time-of-day (ARCHITECTURE.md §6)
export function getStaticCongestionFactor() {
  const hour = new Date().getHours();
  // Morning peak: 8 - 10 AM, Evening peak: 5 - 8 PM
  if ((hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20)) {
    return { multiplier: 1.35, period: 'Peak Congestion' };
  } else if (hour >= 22 || hour <= 5) {
    return { multiplier: 0.90, period: 'Night Low Traffic' };
  } else {
    return { multiplier: 1.10, period: 'Normal Traffic' };
  }
}

export function calculateOptimizedRoute(origin, destination, priority, incident_id) {
  const distanceKm = calculateDistanceKm(origin, destination);
  const baseSpeedKmH = priority === 'P1' || priority === 'P2' ? 45 : 35;
  const rawTravelMinutes = (distanceKm / baseSpeedKmH) * 60;

  const { multiplier } = getStaticCongestionFactor();
  let travelMinutes = rawTravelMinutes * multiplier;

  let signalPriorityApplied = false;
  let timeSavedMinutes = 0;

  // Signal priority applies to P1 and P2 emergency transports
  if (priority === 'P1' || priority === 'P2') {
    signalPriorityApplied = true;
    // Simulated discount: saves 20% of travel time or up to 5 minutes
    timeSavedMinutes = Math.min(5, Math.max(1, Math.round(travelMinutes * 0.20)));
    travelMinutes -= timeSavedMinutes;

    if (incident_id) {
      db.prepare(`UPDATE incidents SET signal_priority_requested = 1 WHERE id = ?`).run(incident_id);
    }
  }

  const finalEta = Math.max(2, Math.round(travelMinutes));

  // Drone fallback trigger rule:
  // If P1 ground ETA > 20 minutes OR distance > 18 km, trigger medical drone for blood/antivenom/first-aid supply drop
  let droneFallbackTriggered = false;
  let droneReason = '';

  if (priority === 'P1' && (finalEta > 20 || distanceKm > 18)) {
    droneFallbackTriggered = true;
    droneReason = `Critical P1 incident with ground ETA (${finalEta} min) exceeding emergency threshold. Autonomous medical drone dispatched for emergency payload drop (antivenom/first-responder kit).`;

    if (incident_id) {
      db.prepare(`UPDATE incidents SET drone_dispatch_logged = 1 WHERE id = ?`).run(incident_id);

      logAuditEntry({
        action: 'drone_dispatched',
        target_type: 'Incident',
        target_id: incident_id,
        trace_payload: {
          incident_id,
          ground_eta_minutes: finalEta,
          drone_estimated_flight_minutes: Math.max(4, Math.round(distanceKm / 1.5)), // Drone speed ~90 km/h
          payload_type: 'Emergency Hemostatic & Resuscitation Kit',
          reason: droneReason,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  return {
    distance_km: distanceKm,
    base_eta_minutes: Math.round(rawTravelMinutes),
    congestion_multiplier: multiplier,
    signal_priority_applied: signalPriorityApplied,
    time_saved_minutes: timeSavedMinutes,
    final_eta_minutes: finalEta,
    drone_fallback_triggered: droneFallbackTriggered,
    drone_reason: droneReason || undefined,
  };
}
