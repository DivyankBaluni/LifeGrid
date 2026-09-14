# ARCHITECTURE.md — LIFEGRID

Technical spec. Companion to `PRD.md` (product scope, safety requirements, MVP boundaries) — read that first for *why*; this is *how*.

---

## 1. System Architecture

**Pattern:** modular monolith. One deployable service, hard module boundaries enforced in code (not network calls), so it demos as one process but reads like separate services. No microservices — PRD Constraints rule that out for the time budget.

### Modules

| Module | Responsibility |
|---|---|
| **Emergency Intake** | Accepts reports (app/web/SMS), normalizes into an `Incident` |
| **Digital Triage (AI)** | Shared engine: symptoms → P1–P4 + explainability trace. Used by both emergency and routine paths |
| **Ambulance Matching** | Best-fit ambulance selection for emergency path only |
| **Hospital Matching** | Best-fit hospital/facility selection — used by emergency path (dispatch target) and continuity path (referral target) |
| **Route Optimization** | ETA calculation, simulated traffic-signal priority, drone-fallback trigger |
| **Hospital Alerting** | Pushes pre-alerts to matched facility; readiness acknowledgment |
| **Referral & Continuity** | Referral tracking across facility tiers, diagnostic/medicine availability, follow-up scheduling |
| **Offline/SMS Gateway** | Normalizes SMS/IVR/missed-call input into the same intake contract; renders outbound alerts as SMS-safe text |
| **Live Dashboard** | Read-only aggregator: incidents, accessibility map, referral status. No business logic — queries other modules' state |

### Call graph

```
Intake (app/web/SMS) ──> Digital Triage ──┬──> [P1–P3, emergency] Ambulance Matching ──> Route Optimization ──> Hospital Alerting
                                           │                                                        │
                                           └──> [routine] Referral & Continuity ─────────────────────┘
                                                        │                                    (both feed)
                                                        ▼                                          ▼
                                                 Hospital Matching  <───────────────────  shared facility state
                                                                                                     │
                                                                                                     ▼
                                                                                            Live Dashboard (reads all)
```

Rules:
- **Triage is the single fork point.** Both paths call it; it never calls back into either path.
- **Hospital Matching is shared** by Ambulance-side dispatch and by Referral routing — one scoring function, two callers (see §5).
- **Dashboard is read-only.** It never mutates state in another module — prevents the demo UI from becoming a hidden source of truth.
- **Offline/SMS Gateway is an adapter, not a parallel system** — it translates into/out of the same Intake and Alerting contracts every other channel uses. No module should special-case "was this SMS."
- Modules communicate via in-process function calls / a shared event bus (e.g. simple pub-sub), not HTTP — that's what "monolith" buys us: no network flakiness to debug during a demo.

---

## 2. Tech Stack

| Layer | Choice | Why (tied to PRD) |
|---|---|---|
| Frontend | Vanilla HTML/CSS/JS (no framework) | Matches actual team skillset — no React/TS on the frontend team; ES modules + a small set of hand-rolled render functions keep the multi-screen citizen/hospital UI (PRD: live dashboard, multilingual UI) manageable without a build step to debug under time pressure |
| Backend | Node.js + Express, plain JavaScript (no TypeScript) | Matches actual team skillset — freshers/non-coders can read `.js` files with no compile step, no type syntax, no build tooling to debug; keeps the whole stack (frontend + backend) in one familiar language |
| Database | PostgreSQL | Relational integrity for Incident/Patient/Referral/AuditLog relationships (§3); JSONB columns absorb the AI explainability trace without a schema migration per triage rule change |
| Real-time layer | WebSockets (Socket.IO) | Dashboard needs near-real-time incident/alert push (PRD: "near real time" triage-to-dispatch) without client polling; Socket.IO ships a plain-JS client, so this works unchanged with a vanilla frontend — no framework binding required |
| Mapping | Leaflet + OpenStreetMap tiles | No API key friction, no cost ceiling during a demo; sufficient for simulated routes and the accessibility map |
| AI/Triage | Rule-engine + LLM-assisted explanation layer (see §4) | PRD Safety: output must be explainable/traceable — a rule engine is auditable by construction; LLM is used to phrase the trace, not to decide the score |
| Auth | JWT + role claims | Backs the RBAC matrix (§8) without a separate identity service |

### Mocked vs. real (hackathon)

| Real | Mocked/Simulated |
|---|---|
| Triage scoring logic | Live traffic data (§6 uses a static congestion model) |
| Matching algorithm (§5) | SMS/IVR gateway (Offline module simulates carrier behavior; see AGENTS.md for exact stub) |
| Route ETA math | Drone dispatch (trigger logic is real, actual dispatch is a logged mock event) |
| Dashboard + WebSocket push | Ambulance/hospital/specialist data (seeded, not from a real registry) |
| RBAC + audit log | Real medical record interoperability (FHIR/ABDM — Future Scope) |
| DB schema & relationships | Teleconsultation (routing decision is real; the call itself is a stub screen) |

---

## 3. Data Models

Sensitivity flags: **PII** (identifies a person), **PHI** (medical/health data — PII + PHI together drive RBAC in §8), **LOC** (precise location).

### Incident
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| reported_by | user_id (FK) | may be anonymous bystander — nullable |
| channel | enum(app, web, sms, ivr) | |
| location | geo_point | **LOC** |
| raw_symptoms | text | free text or structured checklist input |
| patient_id | uuid (FK, nullable) | may be unknown at report time |
| triage_result_id | uuid (FK) | |
| status | enum(reported, triaged, matched, dispatched, alerted, resolved, cancelled) | |
| created_at, updated_at | timestamp | |

### Patient
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | string, nullable | **PII** — nullable because emergency reports may not have it |
| age_band | enum | avoid exact DOB where not needed — minimizes PII surface |
| high_risk_flags | enum[] (maternal, child, chronic) | **PHI** |
| known_conditions | text[], nullable | **PHI** |
| language_pref | enum | |

### Ambulance
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| capability_tags | enum[] (BLS, ALS, trauma, neonatal) | |
| current_location | geo_point | **LOC** |
| status | enum(available, dispatched, en_route, at_scene, returning) | |
| assigned_incident_id | uuid (FK, nullable) | |

### Hospital
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| tier | enum(sub_centre, phc, rural_hospital, district_hospital) | drives referral-chain ordering |
| capability_tags | enum[] (trauma, icu, neonatal, cardiac, ...) | |
| bed_capacity | int | |
| beds_available | int | |
| specialists_on_site | Specialist[] (FK) | |
| diagnostics_available | enum[] | simulated dataset |
| medicines_available | enum[] | simulated dataset |
| location | geo_point | **LOC** |
| accessibility_status | enum (see DESIGN.md §2) | derived, not stored raw — computed from capacity + specialist + capability fields |

### Specialist
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| hospital_id | uuid (FK) | |
| specialty | enum | |
| available | boolean | |

### Referral
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| patient_id | uuid (FK) | **PHI** via patient link |
| from_facility_id, to_facility_id | uuid (FK → Hospital) | |
| reason | text | **PHI** |
| triage_result_id | uuid (FK) | shared engine — same trace as emergency path |
| status | enum(initiated, in_transit, received, completed, dropped) | |
| context_payload | jsonb | carries prior visit summary forward — this *is* the "receiving facility has context" feature |
| created_at, updated_at | timestamp | |

### User/Role
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| role | enum(citizen, health_worker, ambulance_crew, hospital_staff, specialist, control_center_operator, admin) | drives §8 RBAC |
| facility_id | uuid (FK, nullable) | for staff/specialist roles |
| language_pref | enum | |

### AuditLog
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| actor_user_id | uuid (FK, nullable) | null = system/AI-initiated |
| action | enum(triage_generated, override_applied, match_selected, referral_created, data_accessed, ...) | |
| target_type, target_id | string, uuid | polymorphic reference (Incident, Referral, etc.) |
| trace_payload | jsonb | full explainability trace for AI actions (§4); required, not optional, for any `triage_generated` or `match_selected` row |
| timestamp | timestamp | |

**Relationships:** Incident → Patient (many-to-one, nullable), Incident → Ambulance (one-to-one when dispatched), Incident/Referral → Hospital (many-to-one), Referral → Referral (self-referential chain: PHC→rural→district), all AI-driven writes → AuditLog (one-to-many, mandatory).

---

## 4. AI Triage Logic

**Never a diagnosis. Always explainable. Always overridable. Never silently trusts uncertain input.** (PRD Safety Considerations — non-negotiable.)

### Pipeline

```
Structured symptom input (checklist first, free text supplementary)
        │
        ▼
Rule-engine scorer (deterministic, versioned rule set)
        │  ── each rule fires → contributes a weighted signal + a plain-language reason
        ▼
Aggregate score → P1–P4 bucket
        │
        ▼
Confidence check:
   - missing required fields → flag `incomplete_input: true`, do not upgrade to false certainty
   - conflicting signals → flag `conflicting_input: true`, bucket defaults to the MORE urgent of the two candidates (fail toward caution)
        │
        ▼
Explainability trace assembled (see below) → written to AuditLog
        │
        ▼
Presented to human (health worker / control-center operator) as a SUGGESTION, labeled "AI-suggested priority," never "diagnosis"
        │
        ▼
Human confirms OR overrides (override always available, always logged with the human's reason)
```

### Priority bands
- **P1** — immediate life threat (e.g. unresponsive, severe bleeding, suspected cardiac event)
- **P2** — urgent, time-sensitive (e.g. major trauma, breathing difficulty)
- **P3** — needs care soon, not immediately life-threatening
- **P4** — routine/non-urgent (feeds the continuity path, not dispatch)

### Explainability trace (mandatory shape, stored per triage event)
```json
{
  "triage_id": "uuid",
  "rule_set_version": "string",
  "inputs_used": ["symptom_a", "symptom_b", "..."],
  "inputs_missing": ["..."],
  "signals_fired": [
    { "rule": "unresponsive_flag", "weight": 0.9, "reason": "Patient reported unresponsive" }
  ],
  "score": 0.0,
  "priority": "P1",
  "confidence_flags": { "incomplete_input": false, "conflicting_input": false },
  "human_reviewed": false,
  "override": null
}
```

### Human-override path
Any role with triage-review permission (health worker, control-center operator — see §8 RBAC) can change the bucket. Override writes a new `AuditLog` row referencing the original trace, with `override.reason` required (free text, non-optional) and `override.by_user_id`. The original AI trace is never deleted or edited — overrides append, they don't replace, so the audit trail shows both what the AI suggested and what the human decided.

The LLM's role (if used) is strictly to turn `signals_fired` into a readable sentence for the UI — it does not compute the score and does not see raw patient data beyond what's already in the structured signal list. This keeps the actual priority decision inside the deterministic rule engine, which is what makes it auditable.

---

## 5. Matching Algorithm — "best fit, not nearest"

Same scoring function serves both callers: Ambulance Matching (against Ambulances) and Hospital Matching (against Hospitals, called by both the emergency dispatch path and the Referral path).

```
score = (capability_match × W_cap) + (capacity_score × W_capacity) + (proximity_score × W_dist) + (eta_score × W_eta)
```

- **capability_match** — binary/graded: does the target have the required capability tag(s) for this incident's triage output (e.g. P1 trauma needs `trauma` + `icu`)? Missing a *required* tag caps the total score low regardless of other terms — a close hospital that can't treat the case should never outrank a competent one further away.
- **capacity_score** — normalized `beds_available / bed_capacity` (or ambulance availability state)
- **proximity_score** — inverse of raw distance, normalized
- **eta_score** — inverse of Route Optimization's computed ETA (§6), normalized — distinct from proximity because traffic/route can make a nominally-closer option slower

Weights (`W_cap` highest, `W_eta` second) are configurable per triage priority — P1 weights ETA and capability more heavily than P3/routine referrals, where capacity and continuity (existing referral relationship) can matter more.

### Worked example — Hospital A vs. Hospital B

Incident: P1, suspected cardiac event, requires `cardiac` capability.

| | Hospital A | Hospital B |
|---|---|---|
| Distance | 2 km (nearest) | 9 km |
| Capability | No cardiac specialist on site | Cardiac specialist + cath lab |
| Beds available | 1/20 | 12/40 |
| ETA (simulated traffic) | 6 min | 14 min |

- Hospital A: `capability_match` fails the required-tag check → score capped low (e.g. 0.15) regardless of its excellent proximity/ETA.
- Hospital B: `capability_match` = 1.0, `capacity_score` healthy, `eta_score` lower than A's but not capped.
- **Result: Hospital B wins.** The system pre-alerts B and routes the ambulance there directly — avoiding the failure case named in the PRD ("ambulance dispatched, receiving hospital lacks capability, has to search again, losing the minutes that matter").

This same function, called with a P4/routine triage result and `to_facility_id` search scope, is what powers Referral routing — just with different weights and no dispatch step.

---

## 6. Route Optimization

- **ETA base calculation**: haversine/road-network distance (via mapping library routing, §2) × a simulated average-speed-by-road-class factor.
- **Simulated traffic-signal priority**: a static congestion multiplier table keyed by time-of-day and road segment (seeded data, not live feed — PRD Constraints explicitly rule out real traffic integration). When a P1/P2 incident's route crosses a "signal-priority-eligible" segment, ETA is reduced by a fixed simulated discount and the dashboard shows a "signal priority requested" indicator — this demonstrates the *concept*, not a real traffic-authority integration.
- **Drone-fallback trigger**: if computed ground ETA for a P1 incident exceeds a configured threshold (e.g. 20 min) AND the route/terrain flag suggests ground access is degraded, the system logs a simulated drone-dispatch event (medical supply drop, not patient transport) visible on the dashboard. This is a logged mock, not a real dispatch call (§2).

---

## 7. API Surface

REST for CRUD/state, WebSocket for push. SMS/low-bandwidth equivalents noted per use case.

| Use case | Endpoint | SMS/low-bandwidth equivalent |
|---|---|---|
| Report emergency | `POST /incidents` | Inbound SMS/missed-call → Offline Gateway parses into same payload shape |
| Get triage result | `POST /triage` (called internally by intake; also directly for non-emergency) | IVR menu (numeric keypad symptom selection) → same triage call |
| Get match result | `GET /incidents/:id/match` | N/A (system-initiated, not user-pulled) |
| Hospital pre-alert | `POST /alerts` (system → hospital staff) | Outbound SMS to registered facility contact number, plain-text template |
| Acknowledge readiness | `PATCH /alerts/:id/ack` | Reply SMS keyword ("READY") parsed by Offline Gateway |
| Live dashboard feed | `WS /dashboard/stream` | N/A — control-center only, assumed connected |
| Initiate referral | `POST /referrals` | Health worker SMS shortcode with structured fields |
| Update referral status | `PATCH /referrals/:id` | Reply SMS keyword |
| Facility accessibility map | `GET /facilities/accessibility` | N/A — dashboard only |
| Diagnostic/medicine lookup | `GET /facilities/:id/availability` | SMS query shortcode → single-line text reply |
| Follow-up schedule | `POST /followups`, `GET /followups?patient_id=` | SMS reminder outbound only (no inbound query in MVP) |
| Override triage | `PATCH /triage/:id/override` | Not available over SMS — requires authenticated role UI |

All state-changing endpoints require a JWT with a role claim; see §8 for the access matrix.

---

## 8. Offline / Multilingual / Security

### SMS-IVR fallback flow
```
Inbound SMS/missed-call → Offline/SMS Gateway
    → missed-call = trigger callback IVR (numeric menu: 1=symptom category, 2=confirm location via cell tower/last-known, ...)
    → SMS = keyword/structured-field parser (e.g. "EMRG <symptom-code> <location>")
    → normalized into standard Incident/Triage payload → rest of pipeline is channel-agnostic from here
Outbound: any alert/pre-alert/reminder is rendered twice — rich payload for app/dashboard, plain-text template for SMS
```
Degraded-connectivity principle: the app itself should queue writes locally and sync when connectivity returns, rather than blocking the user — applies to both emergency and referral flows per PRD Non-Functional Requirements.

### Multilingual approach
- UI strings externalized (i18n keys, not hardcoded) from day one, even though MVP only requires the citizen-facing report/triage screen translated.
- Triage rule engine's `signals_fired.reason` strings are template-based with per-language variants, not machine-translated at render time — keeps the explainability trace accurate across languages.
- SMS templates are per-language, selected by the `User.language_pref` or a language-select IVR step for anonymous reporters.

### RBAC access matrix

| Role | Incident (create) | Incident (view) | Patient PHI | Triage override | Referral (create/update) | Facility capacity (edit) | Dashboard | AuditLog |
|---|---|---|---|---|---|---|---|---|
| Citizen | ✅ (own) | ✅ (own) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Health worker | ✅ | ✅ (assigned) | ✅ (assigned patients) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ambulance crew | ❌ | ✅ (assigned) | limited (triage summary only) | ❌ | ❌ | ❌ | ❌ | ❌ |
| Hospital staff | ❌ | ✅ (incoming alerts) | ✅ (incoming patients) | ✅ (incoming only) | ✅ (own facility) | ✅ (own facility) | ❌ | ❌ |
| Specialist | ❌ | ✅ (referred-in) | ✅ (referred-in) | ❌ | ✅ (own referrals) | ❌ | ❌ | ❌ |
| Control-center operator | ✅ (on behalf) | ✅ (all) | ✅ (all) | ✅ (all) | ✅ (all) | ❌ | ✅ | ✅ (read) |
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Encryption & audit-trail
- PII/PHI/LOC fields (flagged in §3) encrypted at rest (column-level or full-disk, whichever the hackathon DB setup supports — document the actual choice in code, not just here).
- All traffic over TLS.
- Every AI-generated decision (triage, match) and every override writes to `AuditLog` — non-optional, not best-effort (§3, §4). Dashboard/control-center can read the log; no role can delete from it.
- Blockchain-backed audit trail is explicitly Future Scope (PRD) — strong encryption + RBAC + append-only AuditLog is the MVP bar.