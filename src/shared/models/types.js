/**
 * LIFEGRID Shared Data Model Definitions & Constants
 * Source of truth for domain models, sensitivity classifications (PII, PHI, LOC),
 * and triage/matching trace shapes per ARCHITECTURE.md §3, §4, §8.
 */

export const USER_ROLES = [
  'citizen',
  'health_worker',
  'ambulance_crew',
  'hospital_staff',
  'specialist',
  'control_center_operator',
  'admin',
];

export const TRIAGE_PRIORITIES = ['P1', 'P2', 'P3', 'P4'];

export const INCIDENT_STATUSES = [
  'reported',
  'triaged',
  'matched',
  'dispatched',
  'alerted',
  'resolved',
  'cancelled',
];

export const INTAKE_CHANNELS = ['app', 'web', 'sms', 'ivr'];

export const AMBULANCE_STATUSES = [
  'available',
  'dispatched',
  'en_route',
  'at_scene',
  'returning',
];

export const FACILITY_TIERS = [
  'sub_centre',
  'phc',
  'rural_hospital',
  'district_hospital',
];

export const ACCESSIBILITY_STATUSES = [
  'phc_functioning',
  'specialist_unavailable',
  'emergency_unavailable',
  'ambulance_available',
  'referral_required',
];

export const REFERRAL_STATUSES = [
  'initiated',
  'in_transit',
  'received',
  'completed',
  'dropped',
];

/**
 * @typedef {Object} GeoPoint
 * @property {number} latitude
 * @property {number} longitude
 * @property {string} [address]
 * @property {string} [landmark]
 */

/**
 * @typedef {Object} Patient
 * @property {string} id
 * @property {string|null} name
 * @property {'pediatric'|'adult'|'geriatric'} age_band
 * @property {string[]} high_risk_flags
 * @property {string[]} known_conditions
 * @property {string} language_pref
 * @property {string} created_at
 */

/**
 * @typedef {Object} SignalFired
 * @property {string} rule
 * @property {number} weight
 * @property {string} reason
 */

/**
 * @typedef {Object} ExplainabilityTrace
 * @property {string} triage_id
 * @property {string} rule_set_version
 * @property {string[]} inputs_used
 * @property {string[]} inputs_missing
 * @property {SignalFired[]} signals_fired
 * @property {number} score
 * @property {'P1'|'P2'|'P3'|'P4'} priority
 * @property {{ incomplete_input: boolean, conflicting_input: boolean }} confidence_flags
 * @property {boolean} human_reviewed
 * @property {Object|null} override
 * @property {string} plain_language_summary
 */
