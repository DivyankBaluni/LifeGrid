# AGENTS.md — LIFEGRID

Instructions for an AI coding agent working in this repo. This is not product docs — read `PRD.md` for scope/why and `ARCHITECTURE.md` for the technical spec before writing code. This file governs *how you work*, not *what the system does*.

---

## Non-negotiable guardrails

These come from PRD §Safety Considerations and are not subject to tradeoff against demo polish, deadline pressure, or "just for now." If a change would violate one of these, stop and flag it instead of shipping it.

1. **Never render AI triage output as a diagnosis.** UI copy, API response shapes, and log messages must say "AI-suggested priority" or equivalent — never "diagnosis," "the patient has X," or similar. Check any new UI string or API doc comment against this before merging.
2. **Every AI-generated triage or match decision must produce an explainability trace and write it to `AuditLog`.** See ARCHITECTURE.md §3 (AuditLog schema) and §4 (trace shape). If you add a new AI-driven decision point, it needs a trace — no exceptions for "quick prototype" code.
3. **Every AI decision must have a working human-override path before it's considered done.** Don't ship the triage scorer without the override endpoint in the same PR/session — a triage feature with no override is not a partial implementation of this system, it's a different, disallowed system.
4. **Uncertain/incomplete input must be flagged, never silently upgraded to certainty.** If you're implementing input handling and a required field is missing, set `incomplete_input: true` per ARCHITECTURE.md §4 — don't default it to a "normal" value to keep the pipeline moving.

If you're unsure whether a shortcut violates one of these, treat it as a violation and ask rather than proceeding.

---

## Build order

Time-boxed hackathon build. Work top to bottom on the critical path; parallelize the second list only once the critical path is demoable end-to-end, even in rough form.

### Critical path (sequential)
1. **Data models** — ARCHITECTURE.md §3, all core entities, migrations runnable, seed script stubbed (empty is fine at this stage).
2. **Triage engine** — ARCHITECTURE.md §4. Get the rule engine + explainability trace + override endpoint working against seed symptom data before touching matching. This is the fork point every other module depends on.
3. **Matching** — ARCHITECTURE.md §5 (Ambulance + Hospital, shared scoring function). Build the Hospital A/B scenario as your first test case — it's the PRD's own example, use it as the acceptance test.
4. **Dashboard (read path)** — minimal live view: incident list, status, matched facility. Doesn't need the accessibility map or referral view yet — just prove the pipeline is observable end-to-end.

Do not start module 2 before module 1's core entities (Incident, Patient, Hospital, Ambulance, AuditLog) are real tables you can write to. Do not start module 3 before triage reliably returns a priority + trace.

### Parallelizable (once critical path demos end-to-end)
- Offline/SMS Gateway (mocked per below)
- Multilingual layer (i18n scaffolding + citizen-facing screen translation)
- Accessibility map on the dashboard
- Referral & Continuity module (routine path, referral tracking, diagnostic/medicine availability)
- Route optimization refinements (traffic-signal simulation, drone-fallback trigger)

If time runs short, cut from this list, not from the critical path. The emergency chain is the demo centerpiece per PRD — protect it.

---

## What stays mocked — don't chase these integrations

PRD Constraints already rule these out. Building real versions burns time the plan doesn't have and doesn't move the demo bar. See ARCHITECTURE.md §2 for the full mocked/real table; the ones most likely to tempt scope creep:

- **Live traffic data** — use the static congestion multiplier table (ARCHITECTURE.md §6). No traffic API integration.
- **SMS gateway** — no Twilio/carrier account. Simulate inbound SMS as a plain HTTP endpoint that accepts `{from, body}` and feeds it through the same Offline Gateway parser a real gateway would call. Simulate outbound as a log line / in-app "sent SMS" panel, not an actual send.
- **Drone dispatch** — trigger logic is real (ARCHITECTURE.md §6), the dispatch itself is a logged event, not a call to any drone API or hardware.
- **Real teleconsultation** — routing decision only; the "call" is a static stub screen ("Teleconsultation would start here").
- **FHIR/ABDM interoperability** — data model should be *shaped* compatibly (ARCHITECTURE.md §3) but do not implement an actual standards-compliance layer.

If you find yourself installing an SDK for any of the above, stop — that's a signal you've drifted off the PRD's Constraints.

---

## File/module structure conventions

Modular monolith — one deployable, hard boundaries in code. Mirror the module list in ARCHITECTURE.md §1 directly:

```
/src                     # Node.js + Express backend, plain JavaScript
  /modules
    /intake            # Emergency Intake
    /triage             # Digital Triage (AI) — shared by both paths
    /ambulance-matching
    /hospital-matching  # shared by dispatch + referral callers
    /route-optimization
    /hospital-alerting
    /referral            # Referral & Continuity
    /offline-gateway     # SMS/IVR adapter
    /dashboard           # read-only aggregator
  /shared
    /models             # Incident, Patient, Ambulance, Hospital, Specialist, Referral, User, AuditLog
    /audit               # AuditLog write helper — every module imports this, nothing writes AuditLog directly
    /rbac                # role/permission checks, ARCHITECTURE.md §8 matrix
  /api                  # route handlers, thin — delegate to /modules
  /db                   # migrations, seed scripts
/client                 # Vanilla HTML/CSS/JS frontend — no framework, no build step
  /pages                # one .html entry point per screen (ARCHITECTURE.md §7 use cases / DESIGN.md §3 screens)
  /scripts               # plain .js modules (ES modules via <script type="module">), one per page plus /shared for fetch/socket helpers
  /styles                 # shared CSS (design tokens from DESIGN.md §1 as CSS variables) + per-page stylesheets
  /i18n                   # JSON string tables per language, loaded at runtime — see ARCHITECTURE.md §8 multilingual approach
```

Rules:
- A module only calls another module through its exported interface — no reaching into another module's internal files.
- Dashboard imports read-only query functions from other modules; it never imports their write paths.
- Anything that writes to `AuditLog` goes through `/shared/audit`, not ad hoc inserts, so the "every AI decision is logged" guardrail is enforced in one place instead of trusted per-caller.
- Seed data lives in `/db/seed`, organized per scenario (see demo bar below), not as one undifferentiated fixture dump.
- Whole stack is plain JavaScript — no `.ts`/`.tsx` anywhere, no compile step, no build tooling on either side (ARCHITECTURE.md §2: chosen so freshers/non-coders on the team can read any file without extra syntax to learn). Backend and frontend stay decoupled the same way regardless — pass plain JSON over the API/WebSocket boundary rather than trying to "share" a model definition between them. If the same shape (e.g. the triage trace, §4) is needed on both sides, define it once in `/src/shared/models` as the source of truth (with a comment describing its fields, since there's no type system to enforce them) and treat the frontend's copy as plain JSON it trusts the backend to send correctly.

---

## Demo bar

Per PRD Success Metrics: **one seeded incident, walkable end-to-end, in under 3 minutes.** Build toward this as the definition of done for the critical path, not toward "all features implemented."

Seed data to build, as separate named fixtures under `/db/seed`:

1. **Hospital A/B scenario** (mirrors ARCHITECTURE.md §5 worked example) — one P1 incident, two candidate hospitals where the nearer one lacks required capability and the farther one has it. This is the single most important fixture: it's the proof that "best fit, not nearest" works, and it should be the first thing you can click through.
2. **Low-connectivity scenario** — one incident submitted via the simulated SMS endpoint (not the app UI), demonstrating the Offline Gateway parses it into the same pipeline the app path uses, and an outbound alert renders as an SMS-safe plain-text template.

Both fixtures should be triggerable from a single seed script (`npm run seed:demo` or equivalent) so the demo doesn't depend on manually re-entering data before a run-through. A secondary referral/continuity walkthrough (PRD: demoable in under 2 more minutes) can reuse the Hospital A/B facilities as its PHC→rural→district chain once the Referral module is built — don't create a third disconnected fixture set for it.