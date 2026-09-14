import { getAllIncidents } from '../intake/index.js';
import { getAllHospitals } from '../hospital-matching/engine.js';
import { getAllAmbulances } from '../ambulance-matching/engine.js';
import { getAllReferrals } from '../referral/index.js';
import { getAllAuditLogs } from '../../shared/audit/index.js';
import { getOutboundSMSLog } from '../offline-gateway/index.js';

export function getDashboardOverview() {
  const incidents = getAllIncidents();
  const hospitals = getAllHospitals();
  const ambulances = getAllAmbulances();
  const referrals = getAllReferrals();
  const recentAudit = getAllAuditLogs(15);
  const smsLogs = getOutboundSMSLog().slice(0, 10);

  // Compute live metrics
  const activeEmergencies = incidents.filter(
    (i) => i.status !== 'resolved' && i.status !== 'cancelled'
  );
  const availableAmbulances = ambulances.filter((a) => a.status === 'available').length;
  const inTransitReferrals = referrals.filter((r) => r.status === 'in_transit' || r.status === 'initiated').length;

  return {
    metrics: {
      total_incidents: incidents.length,
      active_emergencies: activeEmergencies.length,
      available_ambulances: availableAmbulances,
      total_ambulances: ambulances.length,
      referrals_in_transit: inTransitReferrals,
      facilities_monitored: hospitals.length,
    },
    incidents,
    hospitals,
    ambulances,
    referrals,
    recent_audit_logs: recentAudit,
    recent_sms_logs: smsLogs,
  };
}
