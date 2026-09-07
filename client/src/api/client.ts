import { io, Socket } from 'socket.io-client';

const API_BASE = 'http://localhost:3001/api';
export const socket: Socket = io('http://localhost:3001', {
  autoConnect: true,
});

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
}

export async function fetchDashboardOverview() {
  const res = await fetch(`${API_BASE}/dashboard/overview`);
  if (!res.ok) throw new Error('Failed to load dashboard overview');
  return res.json();
}

export async function reportEmergency(payload: {
  raw_symptoms: string;
  checklist_symptoms?: string[];
  location: { latitude: number; longitude: number; address: string };
  patient_id?: string;
  age_band?: string;
  known_conditions?: string[];
  channel?: string;
}) {
  const res = await fetch(`${API_BASE}/incidents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channel: 'app',
      ...payload,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to report emergency');
  }
  return res.json();
}

export async function evaluateRoutineTriage(payload: {
  raw_symptoms: string;
  checklist_symptoms?: string[];
  age_band?: string;
  known_conditions?: string[];
}) {
  const res = await fetch(`${API_BASE}/triage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to evaluate triage');
  }
  return res.json();
}

export async function overrideTriage(
  triageId: string,
  overriddenPriority: 'P1' | 'P2' | 'P3' | 'P4',
  reason: string,
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
    const err = await res.json();
    throw new Error(err.error || 'Failed to submit override');
  }
  return res.json();
}

export async function acknowledgeAlert(alertId: string, checklist: {
  bed_confirmed?: boolean;
  specialist_confirmed?: boolean;
  equipment_confirmed?: boolean;
}) {
  const res = await fetch(`${API_BASE}/alerts/${alertId}/ack`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ checklist }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to acknowledge alert');
  }
  return res.json();
}

export async function getHospitalAlerts(hospitalId: string) {
  const res = await fetch(`${API_BASE}/alerts/hospital/${hospitalId}`);
  if (!res.ok) throw new Error('Failed to fetch hospital alerts');
  return res.json();
}

export async function createReferral(payload: any) {
  const res = await fetch(`${API_BASE}/referrals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create referral');
  }
  return res.json();
}

export async function updateReferralStatus(referralId: string, status: string) {
  const res = await fetch(`${API_BASE}/referrals/${referralId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to update referral status');
  }
  return res.json();
}

export async function sendSimulatedSMS(from: string, body: string) {
  const res = await fetch(`${API_BASE}/offline/sms/inbound`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, body }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to send SMS');
  }
  return res.json();
}

export async function sendSimulatedIVR(callerNumber: string, digits: string) {
  const res = await fetch(`${API_BASE}/offline/ivr/inbound`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caller_number: callerNumber, keypad_digits: digits }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to process IVR');
  }
  return res.json();
}

export async function fetchOutboundSMSLogs() {
  const res = await fetch(`${API_BASE}/offline/sms/outbound`);
  if (!res.ok) throw new Error('Failed to fetch SMS logs');
  return res.json();
}

export async function resetDemoScenario() {
  const res = await fetch(`${API_BASE}/seed/demo`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to reset demo');
  return res.json();
}

export async function fetchPanIndiaHospitals(params: {
  state?: string;
  district?: string;
  specialty?: string;
  has_icu?: boolean;
  has_emergency?: boolean;
  search?: string;
  lat?: number;
  lng?: number;
  limit?: number;
}) {
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

export async function fetchPanIndiaAmbulances(params?: {
  district?: string;
  state?: string;
  type?: string;
}) {
  const query = new URLSearchParams();
  if (params?.district) query.append('district', params.district);
  if (params?.state) query.append('state', params.state);
  if (params?.type) query.append('type', params.type);

  const res = await fetch(`${API_BASE}/pan-india/ambulances?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch pan-India ambulances');
  return res.json();
}

export async function predictMLTriage(payload: {
  symptoms: string;
  checklist?: string[];
  vitals?: { spo2?: number; pulse?: number; systolic_bp?: number };
  age_band?: string;
  patient_count?: number;
}) {
  const res = await fetch(`${API_BASE}/ai/triage-predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to run AI triage prediction');
  return res.json();
}

export async function predictMLETARoute(payload: {
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
  priority?: string;
  vehicle_type?: string;
}) {
  const res = await fetch(`${API_BASE}/ai/predict-eta`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to predict ML route ETA');
  return res.json();
}

export async function executeMultiDispatch(payload: {
  incident_location: { latitude: number; longitude: number; address?: string };
  patient_count: number;
  chief_complaint: string;
}) {
  const res = await fetch(`${API_BASE}/ai/multi-dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
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


