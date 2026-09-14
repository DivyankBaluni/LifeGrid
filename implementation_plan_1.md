# Implementation Plan: Backend JavaScript Migration & Map / Performance Fixes

Migrate the backend from TypeScript to plain JavaScript (Node.js ES Modules) in strict accordance with [ARCHITECTURE.md](file:///d:/SIH_Lifegrid/SIH_Project/docs/ARCHITECTURE.md) and [AGENTS.md](file:///d:/SIH_Lifegrid/SIH_Project/docs/AGENTS.md). Simultaneously, resolve the critical Leaflet map loading/tile failures, fix blank canvas re-renders, and eliminate frontend startup latency.

---

## 1. Problem Analysis & Root Causes

### 1.1 Backend TypeScript vs Architecture Spec
- **Current State:** The backend in `src/` uses TypeScript (`.ts`), compiling/running via `tsx`.
- **Architecture Requirement:** [ARCHITECTURE.md §2](file:///d:/SIH_Lifegrid/SIH_Project/docs/ARCHITECTURE.md#L48-L59) and [AGENTS.md §File/module structure](file:///d:/SIH_Lifegrid/SIH_Project/docs/AGENTS.md#L57-L93) mandate:
  - *Node.js + Express, plain JavaScript (no TypeScript)*
  - *No `.ts`/`.tsx` anywhere, no compile step, no build tooling on either side*
  - Pass plain JSON over API/WebSocket; use JSDoc / schema definitions in `/src/shared/models` as source of truth.

### 1.2 Map Not Loading / Blank Map / Grey Tiles
- **Root Cause A (Map turns blank white on dispatch):** In [control-center.js](file:///d:/SIH_Lifegrid/SIH_Project/public/screens/control-center.js), `render()` wiped `container.innerHTML`, creating a brand-new `#cc-map-container` DOM element. However, `mapInstance` remained assigned to the detached former DOM node. `if (!mapInstance)` evaluated to `false`, causing Leaflet to never attach to the new container.
- **Root Cause B (Grey tile blocks):** `tile.openstreetmap.org` blocks or rate-limits requests from `127.0.0.1` / `localhost` without User-Agent headers, returning 403/429 HTTP errors. Also, Leaflet was not invalidating container dimensions when rendered in flex columns.

### 1.3 Site Takes a Long Time to Open
- **Root Cause A (Blocking CDN scripts in `<head>`):** [index.html](file:///d:/SIH_Lifegrid/SIH_Project/public/index.html) loaded synchronous render-blocking scripts (`unpkg.com/leaflet`, `cdn.jsdelivr.net/npm/three`, etc.) before DOM parsing. High latency or CDN drops in Indian ISPs stall page loading.
- **Root Cause B (Blocking `await this.loadData()` before initial render):** [app.js](file:///d:/SIH_Lifegrid/SIH_Project/public/app.js) waited for `await this.loadData()` before calling `this.switchTab()`, showing an empty screen.
- **Root Cause C (Hardcoded `localhost:3001` vs `127.0.0.1` CORS/IPv6 delay):** [api.js](file:///d:/SIH_Lifegrid/SIH_Project/public/api.js) hardcoded `http://localhost:3001`, causing DNS/IPv6-to-IPv4 resolution timeouts when accessed via `127.0.0.1` or Live Server.

---

## 2. Proposed Changes

### Component 1: Backend JavaScript Migration (`src/` & `package.json`)

Convert all 21 TypeScript files to plain ECMAScript Modules (`.js`). Node.js v25 runs ES modules natively without any transpilation or build step.

#### [MODIFY] [package.json](file:///d:/SIH_Lifegrid/SIH_Project/package.json)
- Set `"type": "module"`.
- Update scripts:
  - `"dev": "node --watch src/api/server.js"`
  - `"start": "node src/api/server.js"`
  - `"seed:demo": "node src/db/seed/demo.js"`
  - `"test": "node test/verify.js"`
- Remove `typescript`, `tsx`, and `@types/*` devDependencies.

#### [DELETE] `tsconfig.json` & remove `.ts` files after migration to `.js`

#### [MIGRATE TO JS]
- `src/api/server.ts` → `src/api/server.js`
- `src/api/routes/index.ts` → `src/api/routes/index.js`
- `src/shared/db/index.ts` → `src/shared/db/index.js`
- `src/shared/rbac/index.ts` → `src/shared/rbac/index.js`
- `src/shared/audit/index.ts` → `src/shared/audit/index.js`
- `src/shared/models/types.ts` → `src/shared/models/types.js` (clean JSDoc type contracts & constants)
- `src/modules/intake/index.ts` → `src/modules/intake/index.js`
- `src/modules/triage/engine.ts` → `src/modules/triage/engine.js`
- `src/modules/triage/override.ts` → `src/modules/triage/override.js`
- `src/modules/hospital-matching/engine.ts` → `src/modules/hospital-matching/engine.js`
- `src/modules/ambulance-matching/engine.ts` → `src/modules/ambulance-matching/engine.js`
- `src/modules/route-optimization/engine.ts` → `src/modules/route-optimization/engine.js`
- `src/modules/hospital-alerting/index.ts` → `src/modules/hospital-alerting/index.js`
- `src/modules/referral/index.ts` → `src/modules/referral/index.js`
- `src/modules/offline-gateway/index.ts` → `src/modules/offline-gateway/index.js`
- `src/modules/dashboard/index.ts` → `src/modules/dashboard/index.js`
- `src/modules/ai-engine/eta-predictor.ts` → `src/modules/ai-engine/eta-predictor.js`
- `src/modules/ai-engine/triage-ml.ts` → `src/modules/ai-engine/triage-ml.js`
- `src/modules/pan-india/registry.ts` → `src/modules/pan-india/registry.js`
- `src/modules/pan-india/uttarakhand.ts` → `src/modules/pan-india/uttarakhand.js`
- `src/db/seed/demo.ts` → `src/db/seed/demo.js`
- `test/verify.ts` → `test/verify.js`

---

### Component 2: Map & Tile Rendering Fixes

#### [MODIFY] [public/screens/control-center.js](file:///d:/SIH_Lifegrid/SIH_Project/public/screens/control-center.js)
1. **Prevent Map DOM Destruction:**
   - Decouple the map container from state re-renders. When updating incident logs or dispatch results, update only Panel 1, Panel 3, and the bottom table instead of blowing away `#cc-map-container`.
   - If full re-render is triggered, properly teardown existing map: `if (mapInstance) { mapInstance.remove(); mapInstance = null; }` before initializing a new one.
2. **Robust Multi-Provider Tile Layer with Fallback:**
   - Primary: High-speed CartoDB Voyager / Positron tiles (`https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png`, subdomains: `abcd`, maxZoom: 19).
   - Secondary Fallback: OpenStreetMap tiles with tile error listener switching layers automatically.
3. **Automatic Size Invalidation:**
   - Attach a `ResizeObserver` to `#cc-map-container` and call `mapInstance.invalidateSize()` after DOM mounting and window resizing to prevent grey blocks.

---

### Component 3: Frontend Startup Performance & Offline Acceleration

#### [MODIFY] [public/index.html](file:///d:/SIH_Lifegrid/SIH_Project/public/index.html)
- Vendor Leaflet (`leaflet.js`, `leaflet.css`), Socket.IO (`socket.io.min.js`), and Three.js locally in `public/assets/vendor/` so the page loads with **zero external CDN latency** even on slow/offline connections (fulfilling ARCHITECTURE.md §8 degraded-connectivity principles).
- Keep font preconnects and load scripts with `defer` / ES module scripts.

#### [MODIFY] [public/app.js](file:///d:/SIH_Lifegrid/SIH_Project/public/app.js)
- Non-blocking initial render: Call `this.switchTab(this.activeTab)` immediately so the UI renders instantly in under 50ms.
- Run `this.loadData()` asynchronously in the background, updating the active screen when data arrives.

#### [MODIFY] [public/api.js](file:///d:/SIH_Lifegrid/SIH_Project/public/api.js)
- Use dynamic origin detection:
  ```javascript
  const API_BASE = window.location.port === '3001'
    ? '/api'
    : (window.location.origin.includes('5500') ? 'http://127.0.0.1:3001/api' : '/api');
  ```
  This guarantees instant API and WebSocket connectivity whether opened directly on `http://127.0.0.1:3001` or via Live Server on port 5500.

---

## 3. Verification Plan

### Automated Verification
```bash
# 1. Verify all unit tests pass on Node 25 with plain JavaScript
npm test

# 2. Verify demo database seed script runs cleanly on plain JavaScript
npm run seed:demo

# 3. Start development server using native node --watch
npm run dev
```

### Manual & Interactive Browser Verification
1. Open `http://127.0.0.1:3001` in Chrome.
2. Confirm instant page loading (< 100ms) with no CDN blocking or delays.
3. Verify Leaflet map tiles render crisp CartoDB/OSM map immediately with zero grey blocks.
4. Test emergency dispatch (e.g. "Rajpur Crash" or "Ballupur STEMI"):
   - Verify animated ambulances drive along genuine road paths.
   - Verify the map stays active and does NOT turn into a blank white screen.
5. Check all 8 tabs (Control Center, Citizen Emergency, Bed Matrix, Fleet Telemetry, Primary Care, Pre-Alert, Referral Tracker, Offline SMS) for console errors.
