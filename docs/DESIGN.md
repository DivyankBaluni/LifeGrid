# DESIGN.md — LIFEGRID

Visual design system and screen-level spec. Companion to `PRD.md` (scope) and `ARCHITECTURE.md` (data/logic this UI surfaces) — for human designers and an AI coding agent building the UI. Not full mockups: layout descriptions and core elements per screen, tight enough to build from.

---

## 1. Visual Identity

**Tone check first:** this is a public-sector healthcare/emergency product used by control-center operators under real time pressure and by rural citizens with variable literacy — not a consumer app. Every choice below optimizes for *legible and calm under stress*, not *delightful*. No playful illustration style, no bouncy micro-interactions, no gradient-heavy branding.

### Color palette
- **Neutral base:** off-white/near-white background (not stark white — reduces glare fatigue on a control-center screen viewed for hours), dark slate-gray for primary text (not pure black — softer on prolonged reading).
- **Primary (brand/action):** a single desaturated blue — trustworthy, institutional, used for primary buttons, links, active states. Avoid bright/saturated blue (reads as "tech startup," not "health authority").
- **Status colors:** reserved *exclusively* for the two coded systems in §2 (accessibility status, triage severity) — never reused for generic UI decoration (e.g. don't use "success green" for a save-confirmation toast if green is already load-bearing for accessibility status; use the neutral primary blue for generic confirmations instead).
- **Neutral grays:** a 5–6 step gray scale for borders, disabled states, secondary text — kept genuinely neutral (no blue or warm tint) so it never competes with the status palette.

### Typography
- One typeface family, one for UI text and one (optionally) for data/numeric display (e.g. ETA countdowns, bed counts) if a tabular-figure variant is available — legibility at a glance matters more than personality.
- Minimum body text size larger than typical consumer-app defaults — this serves both the health-literacy requirement (§4) and control-center readability at a distance.
- Weight used to establish hierarchy (regular/medium/bold), not size alone — keeps layouts calm rather than shouty.

### Spacing scale
- Standard 4px/8px-based scale (4, 8, 12, 16, 24, 32, 48...). Generous whitespace around actionable elements — this is a stress-context product; cramped layouts read as chaotic, which is the opposite of the intent.

### Overall tone
Calm, institutional, high-legibility. Think "well-run hospital signage," not "startup dashboard." Motion is minimal and functional (a status change animates briefly to draw the eye; nothing animates for decoration). No mascot, no illustrated empty-states with personality — use plain icon + plain text instead.

---

## 2. The Two Color Systems — Kept Visually Distinct

LIFEGRID has two independent coded-color systems on the same dashboard. They must never share hues, or an operator will misread one as the other under time pressure.

### Accessibility status (facility-level, rural healthcare map)
| Status | Color | Meaning |
|---|---|---|
| PHC functioning | Green | Facility operating normally, staffed |
| Specialist unavailable | Amber/yellow | Facility open, but a needed specialist is not on-site |
| Emergency facility unavailable | Orange | Facility cannot currently handle emergency cases (capacity/equipment) |
| Ambulance available | Blue (distinct from primary brand blue — see note) | An ambulance is stationed/available in this facility's coverage area |
| Hospital referral required | Red-violet / magenta | This tier cannot resolve the case; a referral upward is needed |

### Triage severity (P1–P4, incident-level)
| Priority | Color |
|---|---|
| P1 | Red |
| P2 | Orange-red |
| P3 | Yellow-orange |
| P4 | Gray-blue (routine/non-urgent — deliberately *not* green, so it doesn't read as "all clear") |

### Why they don't collide
- **Reds are reserved for triage P1 only.** The accessibility map's most severe state ("hospital referral required") uses magenta/red-violet specifically so it is never confusable with a P1 incident marker at a glance.
- **Green appears only in the accessibility system** ("PHC functioning"), never in triage — so an operator never has a "green = safe" instinct misfire on a triage-severity element.
- **The "ambulance available" blue is a distinct, cooler blue from the primary brand blue** used for buttons/links — differentiated by saturation and hue-shift, not just used interchangeably; test this pairing for colorblind-safe distinction (see §4).
- On any screen showing both systems together (control-center dashboard), use shape/icon coding in addition to color for both systems — never color alone (ties into §4 accessibility rules).

---

## 3. Key Screens

### Citizen/bystander emergency report form
- **Layout:** single-column, one question/decision per screen-step (wizard-style, not one long form) — minimizes cognitive load under panic.
- **Core elements:** large "Report Emergency" entry action; location auto-detected with a visible confirm/adjust step (map pin, not just a text field); symptom input as icon-first tappable checklist (see §4) with free-text as secondary/optional, not primary; a persistent, unmissable "Call instead" fallback for anyone who can't complete the digital flow.
- No login/account creation required to report — friction here can cost lives; identity fields are optional and deferred.

### Patient/health-worker non-emergency triage flow
- **Layout:** similar step-wizard shell to the emergency form (visual consistency lets users transfer learned behavior) but with a visibly calmer entry point — different framing copy ("Get care guidance" not "Report Emergency") and no red urgency styling, so it's not mistaken for the emergency path.
- **Core elements:** symptom checklist (shared component with the emergency form where possible); patient-history context panel for health-worker users (pulled from Referral `context_payload`, ARCHITECTURE.md §3) so a returning patient isn't re-entering their story; clear routing outcome screen at the end (teleconsult / PHC visit / referral) stated in plain language, explicitly labeled as a suggestion.

### Hospital pre-alert screen
- **Layout:** single-screen, no scrolling required for the critical info — this is read in seconds by busy staff.
- **Core elements:** incoming patient summary (triage priority badge, ETA countdown, key symptoms) at the top; a **readiness checklist** below (bed confirmed / specialist confirmed / equipment confirmed — tappable, each item timestamps when checked); one primary action button ("Acknowledge Ready") that fires the ack endpoint (ARCHITECTURE.md §7); an escalate/decline path if the facility cannot actually take the case (feeds back into re-matching, doesn't silently block).

### Control-center live dashboard
- **Layout:** two-pane — accessibility map (§2) as the dominant left/main pane, scrollable incident list/feed as a right/side panel; a detail drawer opens on selecting either a facility or an incident, rather than navigating away from the map.
- **Core elements:** map with facility markers color-coded per §2 accessibility system, plus incident markers color-coded per triage severity, visually differentiated by marker *shape* (e.g. facility = square/pin, incident = circle/pulse) so overlapping color meanings never merge; incident feed showing status progression (reported → triaged → matched → dispatched → alerted → resolved); filter/search by facility tier or incident priority; every AI-suggested match or triage visibly labeled with an "AI-suggested" tag and a one-tap "view reasoning" affordance that surfaces the explainability trace (ARCHITECTURE.md §4) — this is not optional chrome, it's the safety requirement made visible.

### Referral tracking view
- **Layout:** horizontal stepper/timeline (PHC → rural hospital → district hospital) rather than a map-first view — the continuity path is about *sequence*, not geography.
- **Core elements:** current stage highlighted; each stage shows facility name, status, and timestamp; context payload (prior notes/triage summary) visible and explicitly marked as "carried forward" so staff understand this isn't a fresh intake; for high-risk-flagged patients, a visible follow-up schedule indicator (next check-in date) alongside the referral chain.

---

## 4. Accessibility and Health-Literacy Design Rules

- **Icon-first, text-secondary.** Every symptom, status, and action should be recognizable from an icon alone before the label is read — text supports the icon, not the reverse. This matters both for low-literacy users and for multilingual layout stability (below).
- **Minimal text density per screen.** One primary decision or piece of information per screen/section. Resist the urge to add explanatory paragraphs — if something needs a paragraph to explain, it's probably better as a simpler icon-led choice plus a "learn more" that's opt-in, not default-visible.
- **Large touch targets.** Minimum comfortably-tappable size (well above typical desktop-web defaults) throughout citizen-facing and field-worker (ambulance crew) screens — these are used one-handed, outdoors, under stress, sometimes on lower-end devices.
- **Color is never the only signal.** Every use of the two status-color systems (§2) is paired with an icon and/or text label. This is both a colorblind-accessibility requirement and a stress-context safety requirement — operators under pressure shouldn't depend on precise hue discrimination.
- **Multilingual layout, not just multilingual strings.** Design components with variable text-length tolerance from the start:
  - No fixed-width buttons/labels sized to the English string — use min-width + wrap, not truncate, or truncate only with an explicit "view full" affordance for anything decision-critical.
  - Icon-first layouts (above) absorb translation length variance better than text-first ones — this is a second reason to lead with icons, not just a literacy one.
  - Vertical rhythm/spacing scale (§1) should tolerate two-line labels without breaking grid alignment — test key screens with a deliberately long-string language, not just English, before considering a layout done.
  - Right-to-left is not required for MVP languages but component structure shouldn't hard-code left-to-right assumptions in ways that make future RTL support a rewrite.

---

## 5. Low-Connectivity and AI-Suggestion UI Conventions

### Low-connectivity design
- **Every screen that can submit data must show a clear sync-state indicator** (e.g. "Saved on this device — will send when connected" vs. "Sent") rather than a spinner that implies real-time confirmation the network can't yet provide. Never let a user believe a report went out when it's actually queued.
- **Design for the SMS-rendered equivalent, not just the app screen**, on any flow that has one (ARCHITECTURE.md §7): pre-alerts, reminders, and referral updates should be drafted as plain-text templates alongside their rich-UI version, so the two never drift out of sync in tone or critical content.
- **Degrade gracefully, not invisibly.** A low-connectivity user should see *less* rich UI (e.g. no live map tiles) rather than a broken/half-loaded one — build explicit low-bandwidth states for map-heavy screens (accessibility map, route view), not just a loading spinner that never resolves.

### AI-suggestion visual convention (applies across all screens)
- Any AI-generated output (triage priority, match suggestion) gets a consistent, reusable visual treatment: a small "AI-suggested" tag/badge, distinct from confirmed/human-entered data — same badge component everywhere, not a different one per screen.
- The "view reasoning" affordance (explainability trace) uses the same interaction pattern everywhere it appears (dashboard, pre-alert screen, triage outcome screen) — one tap/click to expand, never buried in a settings menu or secondary page.
- The override action, wherever it's available to a role (ARCHITECTURE.md §8), is visually present but not the loudest element on screen — it should read as "available if needed," not as a constant prompt second-guessing the AI, which would erode trust in the normal case while still being immediately reachable in the exception case.
