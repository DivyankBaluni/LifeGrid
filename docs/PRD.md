# PRD.md — LIFEGRID (SIH26133: Rural & Underserved Healthcare Accessibility)

## What are we building and why?

LIFEGRID began as an AI-powered emergency coordination engine — the connective tissue between an emergency being reported and a patient reaching definitive care. For SIH26133, that engine becomes the flagship module inside a broader platform: a rural healthcare accessibility and continuity layer that also addresses the everyday failure modes of rural care — not just the crisis moment.

We are not replacing the public health system (sub-centres, PHCs, rural and district hospitals). We are making the existing system's parts visible to each other, and to the patient, so that care that already exists doesn't get lost between them.

## Problem Statement

**Official (SIH26133):** Rural and underserved communities face long travel distances, shortages of specialists, irregular diagnostics, fragmented medical records, delayed referrals, and limited awareness of available services. Primary facilities have constrained staff and equipment. Patients move between sub-centres, PHCs, rural hospitals, and district hospitals without continuity of information. Connectivity, language, health literacy, and affordability further limit access. The challenge is to improve timely access, continuity, quality, and accountability — while strengthening, not replacing, the public health system.

**Inherited failure case (from the original LIFEGRID emergency scope):** an emergency is reported and an ambulance dispatched, but the receiving hospital turns out to lack the required bed, specialist, or trauma capability — the ambulance then has to search for another hospital, losing the minutes that matter most. This same "the system doesn't know its own state" problem is what causes delayed referrals and fragmented care outside emergencies too — it's one root cause showing up in two settings.

## Vision

A single coordination layer that always knows, in real time: where care is available, what condition a patient is in, and what needs to happen next — whether that "next" is an ambulance and a trauma bed in the next 15 minutes, or a referral to a district hospital specialist next week. LIFEGRID doesn't dispatch ambulances *or* manage referrals as two separate products — it's the same underlying model of "match patient need to the right facility, right now" applied at both timescales.

## Target Users

- **Citizens/patients** in rural and underserved areas — both emergency and routine care
- **Frontline health workers** (ASHA/ANM-style workers, PHC staff) initiating triage, referrals, and follow-ups on a patient's behalf
- **Ambulance drivers/EMTs** receiving dispatch and routing instructions
- **Hospital and PHC staff** receiving pre-alerts, managing referrals, updating capacity/availability
- **Specialists** available for teleconsultation or referral-in
- **Healthcare authorities / control-center operators** overseeing the accessibility map and emergency response
- **Rural/low-connectivity users** via SMS, missed-call, or IVR

## Core Use Cases

**Emergency chain (flagship, carried forward from original LIFEGRID):**
1. A bystander reports an emergency with location, symptoms, and patient info.
2. The system assesses severity via AI-assisted triage (P1–P4).
3. The best-fit ambulance (capability + ETA, not just nearest) is matched and dispatched.
4. The best-fit hospital (capacity, capability, specialist availability, ETA) is selected and pre-alerted.
5. Route is optimized with simulated traffic-signal priority; a drone is dispatched if ETA is too long.
6. The full response is visible on the live control-center dashboard.

**Continuity-of-care chain (new, required by SIH26133's full scope):**
7. A health worker or patient initiates digital triage for a non-emergency complaint and is routed to teleconsultation, a PHC visit, or a referral — using the same triage engine as the emergency flow, at lower urgency.
8. A referral is tracked as the patient moves PHC → rural hospital → district hospital, so the receiving facility has context instead of a patient starting over.
9. Diagnostic coordination: a health worker can see which nearby facility currently has the needed diagnostic capability, instead of sending a patient somewhere that turns out not to have it.
10. Medicine availability is visible at the facility level before a patient travels for it.
11. High-risk patients (maternal, child, chronic condition) get scheduled follow-up tracking so they don't silently drop out of care.
12. Authorities view a facility-level accessibility map — what's functioning, what's unavailable, where referrals are needed — across the coverage area.

## Unified Workflow

```
Patient Need
      ↓
Digital Triage (AI-assisted, urgency-scored)
      ↓
   ┌──────────────┴──────────────┐
   ↓                             ↓
EMERGENCY PATH                ROUTINE PATH
Resource Matching              Referral / Teleconsult Routing
Ambulance + Hospital Match     Diagnostic + Medicine Availability Check
Route Optimization             Facility Handoff w/ Context
Hospital Pre-Alert             Follow-up Scheduling (high-risk)
      ↓                             ↓
   └──────────────┬──────────────┘
                  ↓
      Live Facility Dashboard / Accessibility Map
```

Both paths share the same triage engine, the same facility/capability data, and the same explainability and audit requirements — they diverge only in urgency and what "matching" resolves to (a dispatch vs. a scheduled referral).

## Functional Requirements

Carried forward from emergency scope:
- Emergency reporting via app/web and SMS/missed-call
- AI-based severity assessment (P1–P4) with reasoning
- Ambulance matching by capability, ETA, distance, equipment
- Hospital matching by bed/ICU availability, trauma capability, specialists
- Hospital pre-alert notifications
- Simulated route optimization with traffic-signal priority
- Emergency drone dispatch as supplementary responder
- Live incident dashboard

New for SIH26133 scope:
- Non-emergency digital triage routing (teleconsultation / PHC visit / referral)
- Referral tracking across facility tiers with a shared record context
- Diagnostic capability visibility per facility
- Medicine availability visibility per facility
- High-risk patient follow-up scheduling and reminders
- Facility-level accessibility dashboard (color-coded status map)
- Multilingual interaction for reporting, triage prompts, and alerts
- Data structured to be forward-compatible with interoperable health record standards (full standards compliance is Future Scope, not MVP)

Carried forward as a platform-wide constraint:
- Role-based, encrypted access to medical and location data

## Non-Functional Requirements

- Low-latency response for the emergency path (triage-to-dispatch near real time)
- Resilience under poor/no connectivity (offline/SMS fallback), for both emergency and referral flows
- Explainable AI outputs — every AI suggestion, at either timescale, must be auditable
- Secure handling of sensitive medical and location data
- Scalable enough to demo multiple simultaneous incidents *and* a multi-facility referral scenario

## MVP Scope (Hackathon)

- Full emergency chain from the original PRD (this remains the demo centerpiece)
- Lightweight non-emergency triage reusing the same engine, routing to a referral or teleconsultation flag (teleconsultation itself can be a stub — routing decision is what's demoed, not a live video call)
- Referral tracking across 3 facility tiers (PHC → rural hospital → district hospital) with simulated data
- Diagnostic + medicine availability shown per facility on the dashboard (simulated dataset)
- Rural healthcare accessibility map (color-coded facility status) on the control-center dashboard
- Basic multilingual UI for at least the citizen-facing report/triage screen

## Future Scope

- Real teleconsultation (video/voice) integration
- Full interoperable health records aligned to an approved standard (e.g., ABDM/FHIR)
- Real SMS/USSD gateway integration
- Real-world traffic authority integration for signal priority
- Real drone dispatch integration
- Appointment/queue management system
- Blockchain-backed audit trail (optional — strong encryption + RBAC is sufficient for now)
- Multi-district, multi-language production rollout

## Success Metrics

- Reduction in time from emergency report to hospital arrival (simulated)
- Correct ambulance/hospital match rate in test scenarios
- Referral completion visibility — simulated before/after "does the receiving facility have context" comparison
- Judge/demo clarity: emergency flow understandable end-to-end in under 3 minutes; a secondary referral/continuity flow demoable in under 2 more

## Constraints

- Hackathon time budget — modular monolith, not microservices
- Simulated data throughout (ambulances, hospitals, referrals, diagnostics, medicines, traffic, drones) — no live government or health-system integrations
- Must degrade gracefully without internet on both the emergency and referral paths
- Scope discipline: the continuity-of-care features exist to cover SIH26133's full expected solution, but must not dilute engineering time away from the emergency engine, which is the strongest differentiator in the demo

## Safety Considerations

- AI must never present itself as providing a definitive medical diagnosis — for emergency triage or routine routing
- Every AI recommendation, at either timescale, must be explainable and traceable to inputs
- A human/coordinator or health-worker layer must be able to override or escalate any AI decision
- Uncertain or incomplete information must never be silently treated as fact
- All medical and location data must be access-controlled by role, across both emergency and continuity-of-care data
