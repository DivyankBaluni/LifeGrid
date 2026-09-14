# LIFEGRID Tech-Stack Migration: React + TypeScript → HTML5 + CSS3 + Vanilla JavaScript (ES6+)

This plan details the migration of the frontend of the LIFEGRID Emergency-Response Monolith from React + TypeScript to HTML5, CSS3, and Vanilla JavaScript (ES6+).
As mandated, this is a **tech-stack migration, NOT a redesign or feature rewrite**. All existing UI/UX, layouts, styles, components, multi-panel dashboards, maps, 3D telemetry, and decision algorithms will be faithfully preserved.

---

## 1. Inventory of Components & Behavior to Migrate

### Application Shell (`App.tsx`)
- **Institutional Header**: Brand logo (`LG`), Title ("LIFEGRID"), Badge ("SIH26133"), Live WebSocket status pill (green/orange), subtitle.
- **Controls**:
  - Role switcher dropdown: `control_center_operator`, `health_worker`, `hospital_staff`, `citizen`.
  - Language toggle button: English / Hindi (`en` / `hi`).
  - Demo Reset button: Calls `POST /api/seed/demo`, reloads dashboard overview, triggers feedback notice.
- **Navigation Tabs**:
  1. Control Center Live (`control-center`)
  2. Citizen Emergency (`citizen-emergency`)
  3. Hospital Bed Matrix (`hospital-dashboard`)
  4. Fleet Telemetry & 3D (`ambulance-fleet`)
  5. Primary Care Guidance (`routine-triage`)
  6. Hospital Pre-Alert (`hospital-pre-alert`)
  7. 3-Tier Referral Tracker (`referral-tracker`)
  8. Offline / SMS Testbench (`offline-simulator`)
- **Real-Time WebSocket Listeners**:
  - `connect`, `disconnect`, `incident:new`, `triage:override`, `alert:acknowledged`, `referral:new`, `referral:update`, `dashboard:refresh`.
- **Institutional Footer**: Standard system status, version notice, and deterministic AI audit trail disclaimers.

### Screen 1: Control Center (`ControlCenter.tsx`)
- **Top 4 KPI Cards**: Active Emergencies, Ambulances Ready, Hospitals Active, Referrals Continuity.
- **Panel 1 (Left - Report Emergency)**:
  - 4 Quick scenario presets (Rajpur Crash 4, Selaqui Fire 8, Mussoorie Landslide 12, Ballupur STEMI 1).
  - Coordinates & GPS capture (device GPS + Dehradun center).
  - Patient count selector (1 to 20+ quick buttons + custom input) + unconscious victim count + age inputs.
  - Incident category multi-select grid (10 incident categories with icons).
  - Emergency indicators checklist (Patient condition + Scene hazards).
  - Scene description / Chief complaint input.
  - Estimated severity score preview bar (0-100 formula, Critical/High/Moderate).
  - Multi-Ambulance Dispatch action button.
- **Panel 2 (Center - Interactive Road Map & Telemetry)**:
  - Region selector (Uttarakhand, Pan-India, Maharashtra, Mumbai, Delhi, Bengaluru).
  - Leaflet Map with OpenStreetMap tiles.
  - Markers: Hospitals (district vs PHC), Active Incidents, Ambulances (available vs busy), Target Incident Pin.
  - OSRM Road routing: Polylines drawn along authentic road turns.
  - Smooth multi-ambulance road animation with multi-step milestones (Dispatched -> At Scene -> Delivered).
  - Live progress & ETA banner.
  - Map status bar & legend.
- **Panel 3 (Right - Dispatch Result & AI Bench)**:
  - Triaged severity & load summary banner.
  - Dispatched fleet allocation cards (vehicle number, driver, paramedic, ETA, assigned patient manifest with individual triage priority & condition, designated hospital & matching rationale).
  - Live dispatch milestone timeline.
  - Selected facility details card on map pin click.
- **Bottom Panel (Real-Time Incident Log Table)**:
  - Search filter input + refresh button.
  - Incident table with time, coordinates, symptoms, status badge, triage priority, and "Explain AI" action button.

### Screen 2: Citizen Emergency (`CitizenEmergency.tsx`)
- Persistent 108/112 emergency call banner.
- Bilingual English/Hindi toggle support across all labels and instructions.
- 4-step emergency submission wizard:
  - Step 1: Emergency symptom cards + voice input (`SpeechRecognition`) + text input.
  - Step 2: Patient demographics (infant, child, adult, elderly).
  - Step 3: Location (Device GPS, coordinates, address) + Review summary.
  - Step 4: Dispatch confirmation & live telemetry (ETA countdown, assigned ambulance, assigned hospital, first-aid instructions, Explainability Modal launcher).

### Screen 3: Hospital Bed Matrix (`HospitalDashboard.tsx`)
- Facility header & bed summary badges (Available, Occupied, ICU Active).
- 40-bed interactive allocation matrix (click to cycle: Available -> Occupied -> ICU -> Available).
- Real-time incoming emergency pre-alerts list (synchronized with WebSocket `incident:new` events, showing ETA, severity, ambulance, required resources).

### Screen 4: Fleet Telemetry & 3D (`AmbulanceFleetScreen.tsx`)
- District search input & vehicle class filter dropdown (All, ALS, MICU, BLS, NEO).
- Responsive ambulance cards grid (driver, paramedic, equipment, capacity, base location, status).
- 3D inspector button opening Three.js model viewer.

### Screen 5: Primary Care Guidance (`RoutineTriage.tsx`)
- Primary care digital triage form (patient name, care category: maternal, chronic, minor illness, skin).
- Triage evaluation with explainability badge.
- 3-tier referral creation with carried-forward clinical continuity payload.

### Screen 6: Hospital Pre-Alert Console (`HospitalPreAlert.tsx`)
- Hospital emergency department console.
- Incoming urgent pre-alert card with live ETA countdown.
- Interactive Readiness Checklist: Bed confirmed, Specialist alerted, Equipment ready.
- Acknowledge & confirm reception readiness button.

### Screen 7: 3-Tier Referral Tracker (`ReferralTracker.tsx`)
- Active referral records list.
- Stepper timeline: 1. Initiated at PHC -> 2. In Transit -> 3. Received at District -> 4. Completed.
- Advance status action button.
- Carried-forward clinical continuity payload display (prior symptoms, vitals, interventions, triage summary).

### Screen 8: Offline / SMS Testbench (`OfflineSimulator.tsx`)
- Inbound carrier SMS simulator with keywords (EMRG, LOC) and sample presets.
- Keypad IVR telephony menu simulator.
- Outbound SMS log viewer.

### Shared Modals & Components
- `ExplainabilityModal`: Rationale header, mandatory clinical guardrail alert, confidence check flags, plain language summary, fired clinical signals table, candidate evaluations table, human override status banner, Apply Clinical Override button.
- `OverrideModal`: Priority selector (P1-P4), mandatory clinical rationale textarea (min 5 chars), audit logging.
- `Ambulance3DViewer`: Interactive Three.js WebGL canvas, 3D meshes (body, cab, windshield, wheels, flashing beacons, cross emblems, floor grid), mouse drag 360-degree orbit and wheel zoom controls, specifications and onboard equipment tags.
- `Badges`: Accessibility badges, Triage badges, Facility tier badges, AI suggestion badges.

---

## 2. Proposed Architecture & File Structure

We will place the clean, vanilla frontend directly in `client/` (replacing the React/Vite/TS setup), structured as:

```
client/
├── index.html                  # Single semantic HTML5 entry point
├── css/
│   ├── index.css               # Preserved institutional theme, variables, utilities & layout
│   └── components.css          # Modals, markers, panels, cards, animations
├── js/
│   ├── api.js                  # Preserved API client functions + Socket.IO client
│   ├── state.js                # Centralized state management & event emitter
│   ├── badges.js               # Badge renderers (accessibility, triage, AI suggestion)
│   ├── modals.js               # Explainability modal, Override modal, 3D viewer controller
│   ├── ambulance3d.js          # Three.js 3D ambulance model rendering & animation
│   ├── map.js                  # Leaflet map manager, markers, road polylines, vehicle animation
│   ├── screens/
│   │   ├── controlCenter.js    # Control Center 3-panel screen logic
│   │   ├── citizenEmergency.js # Citizen 4-step emergency flow & voice/GPS
│   │   ├── hospitalDashboard.js# 40-bed matrix & incoming alerts
│   │   ├── ambulanceFleet.js   # Fleet grid & 3D inspection
│   │   ├── routineTriage.js    # Primary care guidance & referral creation
│   │   ├── hospitalPreAlert.js # Receiving facility pre-alert console & checklist
│   │   ├── referralTracker.js  # 3-tier referral stepper & context payload
│   │   └── offlineSimulator.js # SMS & IVR telephony testbench & logs
│   └── app.js                  # Main app controller, header, tabs, role/lang, socket listeners
├── assets/                     # Preserved icons, logos, SVGs
└── public/                     # Static assets (favicons, icons)
```

### Libraries & CDNs
The vanilla implementation will use standard, modern CDN scripts in `index.html`:
- Leaflet 1.9.4 (`leaflet.js` + `leaflet.css`)
- FontAwesome 6.5.0 (`all.min.css`)
- Socket.IO client 4.8.3 (`socket.io.min.js`)
- Three.js r128 (`three.min.js`)
- Google Fonts (`Inter` & `JetBrains Mono`)

### Express Backend Integration
In `src/api/server.ts`, static file serving currently points to `client/dist`. We will update it to serve `client` directly with `express.static(path.resolve(process.cwd(), 'client'))`.
This allows:
1. Running the entire app via `npm run dev` (starts backend + serves frontend at `http://localhost:3001`).
2. Optionally opening `client/index.html` via any static server (like Python `http.server`, Live Server, or `npx serve client`).

---

## 3. Migration Plan Step-by-Step

### Phase 1: Build the HTML5 Layout & Core CSS
- Create `client/index.html` with complete semantic markup for header, role switcher, language switcher, demo reset button, navigation tabs, screen viewports, and modal containers.
- Re-use the proven CSS from `client/src/index.css` without loss of visual styling, dark accents, badges, or animations.

### Phase 2: Implement Core JavaScript Modules
- `js/api.js`: Port all 19 fetch API endpoints and Socket.IO connection from `client.ts` to plain ES6 JavaScript.
- `js/state.js`: Central reactive state store holding `activeTab`, `userRole`, `language`, `overviewData`, `isConnected`.
- `js/badges.js`: HTML generation for accessibility badges, triage badges, and AI suggestion badges.

### Phase 3: Implement Shared Modals & Three.js 3D Viewer
- `js/ambulance3d.js`: Pure Three.js WebGL rendering for the 3D ambulance model with drag-to-rotate, wheel zoom, strobe beacons, and equipment checklist.
- `js/modals.js`: Explainability trace modal (clinical guardrail, signals fired, candidate facility scoring) and Human Override modal (P1-P4 selection, mandatory rationale, audit log recording).

### Phase 4: Implement Map & Routing Controller
- `js/map.js`: Leaflet map initialization, region coordinate centering, facility markers, ambulance markers, incident markers, target incident pin, OSRM road polylines, and multi-vehicle smooth road animation with milestone updates.

### Phase 5: Implement All 8 Screens
- Port each screen to its dedicated JavaScript module:
  - `controlCenter.js`
  - `citizenEmergency.js`
  - `hospitalDashboard.js`
  - `ambulanceFleet.js`
  - `routineTriage.js`
  - `hospitalPreAlert.js`
  - `referralTracker.js`
  - `offlineSimulator.js`

### Phase 6: Wire Application Controller & WebSocket Events
- `js/app.js`: Tab switching, role changes, bilingual language updates, demo scenario resets, real-time WebSocket event dispatching.

### Phase 7: Backend Serving & Cleanup
- Adjust `src/api/server.ts` to serve `client/` directly.
- Clean up React/TS dependencies in `client/package.json` (remove React, ReactDOM, Vite plugins, TypeScript from client).
- Verify backend tests (`npm test`) remain 100% passing.

---

## 4. Verification Plan

### Automated Tests
- Run `npm test` from root to ensure backend triage, hospital matching, ambulance allocation, and SMS intake test suites pass without regression.

### Manual & Interactive Browser Verification
1. **Header & Navigation**:
   - Verify role switcher changes permissions.
   - Verify English/Hindi toggle updates Citizen Emergency screen text.
   - Click "Reset Demo" button and confirm demo data seeds and alert appears.
   - Click every one of the 8 navigation tabs and verify screens load with correct styles.
2. **Control Center Screen**:
   - Test presets: Rajpur Crash (4), Selaqui Fire (8), Mussoorie Landslide (12), Ballupur STEMI (1).
   - Test changing coordinates and clicking "Use Device GPS".
   - Test adjusting patient count, checkboxes, and incident category buttons; verify estimated severity score updates.
   - Click "Dispatch Multi-Ambulance Fleet":
     - Verify API call succeeds.
     - Verify road polylines appear on Leaflet map.
     - Verify animated ambulances drive along road geometry.
     - Verify milestones progress (Dispatched -> At Scene -> Delivered).
     - Verify right panel shows patient manifest, ETAs, and assigned hospitals.
   - Verify bottom table shows incident logs; click "Explain AI" and verify Explainability Modal appears with fired signals and candidate scores.
   - Test "Apply Clinical Override" from modal; verify override is submitted and logged.
3. **Citizen Emergency Screen**:
   - Run 4-step wizard: select symptoms -> patient age -> location -> submit emergency.
   - Verify dispatch confirmation step displays assigned unit, ETA countdown, and first aid tips.
4. **Hospital Bed Matrix**:
   - Click bed cells in the 40-bed matrix and verify state cycles (Available -> Occupied -> ICU).
   - Verify bed summary counters update dynamically.
   - Trigger a dispatch and verify real-time incoming alert is received via WebSocket.
5. **Fleet Telemetry & 3D**:
   - Filter by district and vehicle class.
   - Click "Inspect 3D Ambulance Model"; verify Three.js canvas loads, rotates on mouse drag, zooms on wheel scroll, and beacons flash.
6. **Primary Care Guidance**:
   - Submit consultation and verify triage guidance and facility tier recommendation.
   - Click "Initiate 3-Tier Referral" and verify referral creation.
7. **Hospital Pre-Alert**:
   - Verify countdown timer, clinical details, readiness checklist toggles, and Acknowledge button.
8. **3-Tier Referral Tracker**:
   - Verify referral progression stepper (1 -> 2 -> 3 -> 4) and carried-forward context payload.
9. **Offline / SMS Testbench**:
   - Simulate inbound SMS and verify response in outbound log.
   - Simulate IVR keypad digits and verify processing.
