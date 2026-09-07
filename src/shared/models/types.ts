export type UserRole =
  | 'citizen'
  | 'health_worker'
  | 'ambulance_crew'
  | 'hospital_staff'
  | 'specialist'
  | 'control_center_operator'
  | 'admin';

export type TriagePriority = 'P1' | 'P2' | 'P3' | 'P4';

export type IncidentStatus =
  | 'reported'
  | 'triaged'
  | 'matched'
  | 'dispatched'
  | 'alerted'
  | 'resolved'
  | 'cancelled';

export type IntakeChannel = 'app' | 'web' | 'sms' | 'ivr';

export type AmbulanceStatus =
  | 'available'
  | 'dispatched'
  | 'en_route'
  | 'at_scene'
  | 'returning';

export type FacilityTier =
  | 'sub_centre'
  | 'phc'
  | 'rural_hospital'
  | 'district_hospital';

export type AccessibilityStatus =
  | 'phc_functioning'
  | 'specialist_unavailable'
  | 'emergency_unavailable'
  | 'ambulance_available'
  | 'referral_required';

export type ReferralStatus =
  | 'initiated'
  | 'in_transit'
  | 'received'
  | 'completed'
  | 'dropped';

export interface GeoPoint {
  latitude: number;
  longitude: number;
  address?: string;
  landmark?: string;
}

export interface Patient {
  id: string;
  name: string | null;
  age_band: 'pediatric' | 'adult' | 'geriatric';
  high_risk_flags: ('maternal' | 'child' | 'chronic')[];
  known_conditions: string[];
  language_pref: string;
  created_at: string;
}

export interface SignalFired {
  rule: string;
  weight: number;
  reason: string;
}

export interface ConfidenceFlags {
  incomplete_input: boolean;
  conflicting_input: boolean;
}

export interface HumanOverride {
  overridden_priority: TriagePriority;
  reason: string;
  by_user_id: string;
  by_user_name?: string;
  timestamp: string;
}

export interface ExplainabilityTrace {
  triage_id: string;
  rule_set_version: string;
  inputs_used: string[];
  inputs_missing: string[];
  signals_fired: SignalFired[];
  score: number;
  priority: TriagePriority;
  confidence_flags: ConfidenceFlags;
  human_reviewed: boolean;
  override: HumanOverride | null;
  plain_language_summary: string;
}

export interface Incident {
  id: string;
  reported_by: string | null;
  channel: IntakeChannel;
  location: GeoPoint;
  raw_symptoms: string;
  patient_id: string | null;
  triage_result_id: string | null;
  triage_result?: ExplainabilityTrace;
  status: IncidentStatus;
  matched_ambulance_id: string | null;
  matched_hospital_id: string | null;
  signal_priority_requested?: boolean;
  drone_dispatch_logged?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Ambulance {
  id: string;
  vehicle_number: string;
  capability_tags: ('BLS' | 'ALS' | 'trauma' | 'neonatal')[];
  current_location: GeoPoint;
  status: AmbulanceStatus;
  assigned_incident_id: string | null;
  updated_at: string;
}

export interface Specialist {
  id: string;
  hospital_id: string;
  name: string;
  specialty: string;
  available: boolean;
}

export interface Hospital {
  id: string;
  name: string;
  tier: FacilityTier;
  capability_tags: string[];
  bed_capacity: number;
  beds_available: number;
  specialists_on_site: Specialist[];
  diagnostics_available: string[];
  medicines_available: string[];
  location: GeoPoint;
  contact_number: string;
  accessibility_status: AccessibilityStatus;
  updated_at: string;
}

export interface MatchExplainabilityTrace {
  match_id: string;
  target_type: 'hospital' | 'ambulance';
  incident_id: string;
  selected_id: string;
  selected_name: string;
  weights: {
    w_cap: number;
    w_capacity: number;
    w_dist: number;
    w_eta: number;
  };
  candidate_evaluations: {
    id: string;
    name: string;
    capability_match: number;
    capacity_score: number;
    proximity_score: number;
    eta_score: number;
    distance_km: number;
    eta_minutes: number;
    total_score: number;
    capped_due_to_missing_required_tag: boolean;
    missing_tags: string[];
  }[];
  reasoning: string;
  timestamp: string;
}

export interface ReadinessChecklist {
  bed_confirmed: boolean;
  specialist_confirmed: boolean;
  equipment_confirmed: boolean;
  timestamps: {
    bed_confirmed_at?: string;
    specialist_confirmed_at?: string;
    equipment_confirmed_at?: string;
  };
}

export interface HospitalAlert {
  id: string;
  incident_id: string;
  hospital_id: string;
  eta_minutes: number;
  status: 'sent' | 'acknowledged' | 'declined';
  readiness_checklist: ReadinessChecklist;
  created_at: string;
  acknowledged_at: string | null;
}

export interface ReferralContextPayload {
  prior_symptoms: string;
  triage_summary: string;
  initial_findings: string;
  vital_signs?: {
    bp?: string;
    pulse?: number;
    spo2?: number;
    temp?: number;
  };
  interventions_given: string[];
  referral_urgency: TriagePriority;
  notes: string;
}

export interface Referral {
  id: string;
  patient_id: string;
  patient_name?: string;
  from_facility_id: string;
  to_facility_id: string;
  reason: string;
  triage_result_id: string | null;
  status: ReferralStatus;
  context_payload: ReferralContextPayload;
  created_at: string;
  updated_at: string;
}

export interface FollowUpSchedule {
  id: string;
  patient_id: string;
  due_date: string;
  reason: string;
  facility_id: string;
  status: 'pending' | 'completed' | 'missed';
  created_at: string;
}

export interface User {
  id: string;
  username: string;
  password_hash: string;
  full_name: string;
  role: UserRole;
  facility_id: string | null;
  language_pref: string;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  actor_user_id: string | null;
  action:
    | 'triage_generated'
    | 'override_applied'
    | 'match_selected'
    | 'referral_created'
    | 'data_accessed'
    | 'alert_acknowledged'
    | 'drone_dispatched';
  target_type: string;
  target_id: string;
  trace_payload: ExplainabilityTrace | MatchExplainabilityTrace | Record<string, any>;
  timestamp: string;
}
