// LIFEGRID Frontend API Client (Vanilla ES6)
const isDedicatedBackend = typeof window !== 'undefined' && window.location.port === '3001';
const API_ORIGIN = isDedicatedBackend
  ? window.location.origin
  : 'http://127.0.0.1:3001';

export const API_BASE = `${API_ORIGIN}/api`;

// Socket.IO client instance using the locally vendored or CDN window.io
export const socket = typeof window !== 'undefined' && window.io
  ? window.io(API_ORIGIN, { autoConnect: true, reconnectionDelay: 1000, timeout: 5000 })
  : null;

export async function fetchDashboardOverview() {
  const res = await fetch(`${API_BASE}/dashboard/overview`);
  if (!res.ok) throw new Error('Failed to load dashboard overview');
  return res.json();
}

export async function reportEmergency(payload) {
  const res = await fetch(`${API_BASE}/incidents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channel: 'app',
      ...payload,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to report emergency');
  }
  return res.json();
}

export async function fetchIncidentById(id) {
  const res = await fetch(`${API_BASE}/incidents/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch incident ${id}`);
  return res.json();
}

export async function fetchTriageById(id) {
  const res = await fetch(`${API_BASE}/triage/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch triage result ${id}`);
  return res.json();
}

export async function evaluateRoutineTriage(payload) {
  const res = await fetch(`${API_BASE}/triage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to evaluate triage');
  }
  return res.json();
}

export async function overrideTriage(
  triageId,
  overriddenPriority,
  reason,
  role = 'control_center_operator'
) {
  const res = await fetch(`${API_BASE}/triage/${triageId}/override`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-demo-role': role,
    },
    body: JSON.stringify({
      overridden_priority: overriddenPriority,
      reason,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to submit override');
  }
  return res.json();
}

export async function acknowledgeAlert(alertId, checklist) {
  const res = await fetch(`${API_BASE}/alerts/${alertId}/ack`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ checklist }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to acknowledge alert');
  }
  return res.json();
}

export async function getHospitalAlerts(hospitalId) {
  const res = await fetch(`${API_BASE}/alerts/hospital/${hospitalId}`);
  if (!res.ok) throw new Error('Failed to fetch hospital alerts');
  return res.json();
}

export async function createReferral(payload) {
  const res = await fetch(`${API_BASE}/referrals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create referral');
  }
  return res.json();
}

export async function updateReferralStatus(referralId, status) {
  const res = await fetch(`${API_BASE}/referrals/${referralId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update referral status');
  }
  return res.json();
}

export async function sendSimulatedSMS(from, body) {
  const res = await fetch(`${API_BASE}/offline/sms/inbound`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, body }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to send SMS');
  }
  return res.json();
}

export async function sendSimulatedIVR(callerNumber, digits) {
  const res = await fetch(`${API_BASE}/offline/ivr/inbound`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caller_number: callerNumber, keypad_digits: digits }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to process IVR');
  }
  return res.json();
}

export async function fetchOutboundSMSLogs() {
  const res = await fetch(`${API_BASE}/offline/sms/outbound`);
  if (!res.ok) throw new Error('Failed to fetch SMS logs');
  return res.json();
}

export async function fetchGatewayConfig() {
  const res = await fetch(`${API_BASE}/offline/config`);
  if (!res.ok) throw new Error('Failed to fetch gateway config');
  return res.json();
}

export async function saveGatewayConfig(payload) {
  const res = await fetch(`${API_BASE}/offline/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to save gateway config');
  return res.json();
}

export async function sendDirectCarrierSMS(to, body) {
  const res = await fetch(`${API_BASE}/offline/sms/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, body }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to dispatch SMS');
  }
  return res.json();
}

export async function resetDemoScenario() {
  const res = await fetch(`${API_BASE}/seed/demo`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to reset demo');
  return res.json();
}

export async function fetchPanIndiaHospitals(params = {}) {
  const query = new URLSearchParams();
  if (params.state) query.append('state', params.state);
  if (params.district) query.append('district', params.district);
  if (params.specialty) query.append('specialty', params.specialty);
  if (params.has_icu) query.append('has_icu', 'true');
  if (params.has_emergency) query.append('has_emergency', 'true');
  if (params.search) query.append('search', params.search);
  if (params.lat) query.append('lat', params.lat.toString());
  if (params.lng) query.append('lng', params.lng.toString());
  if (params.limit) query.append('limit', params.limit.toString());

  const res = await fetch(`${API_BASE}/pan-india/hospitals?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch pan-India hospitals');
  return res.json();
}

export async function fetchPanIndiaAmbulances(params = {}) {
  const query = new URLSearchParams();
  if (params.district) query.append('district', params.district);
  if (params.state) query.append('state', params.state);
  if (params.type) query.append('type', params.type);

  const res = await fetch(`${API_BASE}/pan-india/ambulances?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch pan-India ambulances');
  return res.json();
}

export async function predictMLTriage(payload) {
  const res = await fetch(`${API_BASE}/ai/triage-predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to run AI triage prediction');
  return res.json();
}

export async function predictMLETARoute(payload) {
  const res = await fetch(`${API_BASE}/ai/predict-eta`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to predict ML route ETA');
  return res.json();
}

export async function executeMultiDispatch(payload) {
  const res = await fetch(`${API_BASE}/ai/multi-dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Multi-ambulance dispatch failed');
  }
  return res.json();
}

export async function fetchUttarakhandHospitals() {
  const res = await fetch(`${API_BASE}/uttarakhand/hospitals`);
  if (!res.ok) throw new Error('Failed to fetch Uttarakhand hospitals');
  return res.json();
}

export async function fetchUttarakhandFleet() {
  const res = await fetch(`${API_BASE}/uttarakhand/fleet`);
  if (!res.ok) throw new Error('Failed to fetch Uttarakhand fleet');
  return res.json();
}
