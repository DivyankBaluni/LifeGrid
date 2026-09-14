import { executeMultiDispatch, fetchTriageById } from '../api.js';
import { renderAISuggestionBadge } from '../components/ai-suggestion-badge.js';
import { openExplainabilityModal } from '../components/explainability-modal.js';
import { openOverrideModal } from '../components/override-modal.js';
import { openAmbulance3DViewer } from '../components/ambulance-3d-viewer.js';

const REGIONS = {
  dehradun: { name: 'Uttarakhand (Dehradun & Rishikesh Hub)', center: [30.3165, 78.0322], zoom: 12 },
  all: { name: 'Pan-India Overview', center: [20.5937, 78.9629], zoom: 5 },
  maharashtra: { name: 'Maharashtra (Rural Demo Cluster)', center: [19.88, 75.38], zoom: 12 },
  mumbai: { name: 'Mumbai Metropolitan', center: [19.0760, 72.8777], zoom: 12 },
  delhi: { name: 'Delhi NCR Region', center: [28.6139, 77.2090], zoom: 12 },
  bengaluru: { name: 'Bengaluru Tech Corridor', center: [12.9716, 77.5946], zoom: 12 },
};

const INCIDENT_TYPES = [
  { id: 'road', label: 'Road Crash', icon: '🚗', defaultDesc: 'Multi-vehicle collision on highway with severe trauma and multiple casualties' },
  { id: 'cardiac', label: 'Cardiac STEMI', icon: '❤️', defaultDesc: 'Acute STEMI myocardial infarction with cardiogenic shock and pulmonary edema' },
  { id: 'burn', label: 'Fire / Burn', icon: '🔥', defaultDesc: 'Industrial flash fire with 3rd-degree severe burns (>40% BSA) and airway compromise' },
  { id: 'fall', label: 'Fall / Landslide', icon: '⛰️', defaultDesc: 'Gorge fall / landslide accident with compound fractures and spinal injury' },
  { id: 'neuro', label: 'Neuro / Stroke', icon: '🧠', defaultDesc: 'Acute ischemic stroke with hemiplegia and acute loss of consciousness' },
  { id: 'breathing', label: 'Respiratory', icon: '🫁', defaultDesc: 'Acute respiratory failure with severe hypoxic gasping and cyanosis' },
  { id: 'pediatric', label: 'Pediatric Crisis', icon: '👶', defaultDesc: 'Pediatric blunt trauma with severe respiratory distress and cyanosis' },
  { id: 'poisoning', label: 'Poison / Hazmat', icon: '☠️', defaultDesc: 'Organophosphate pesticide ingestion with acute cholinergic crisis' },
  { id: 'obstetric', label: 'Obstetric Emerg.', icon: '🤰', defaultDesc: 'Complicated labor with postpartum hemorrhage and fetal distress' },
  { id: 'drowning', label: 'Drowning', icon: '🌊', defaultDesc: 'Submersion / river drowning near Sahastradhara with hypothermia' },
];

export function createControlCenterScreen({ overviewData, onRefresh, userRole = 'control_center_operator' }) {
  const container = document.createElement('div');
  container.className = 'cc-container';

  let currentData = overviewData;
  let currentRegion = 'dehradun';
  let currentMapStyle = 'osm';
  let selectedIncident = null;
  let selectedFacility = null;
  let searchQuery = '';

  // Form state
  let incidentPin = { lat: 30.3398, lng: 78.0644 };
  let patientCount = 4;
  let unconsciousCount = 1;
  let oldestAge = '58';
  let youngestAge = '24';
  let selectedTypes = ['road'];
  let incidentSymptoms = 'Multiple casualty collision on Rajpur Road: 4 patients (STEMI cardiac shock, intracranial hemorrhage, femur fractures, and blunt chest trauma)';

  let chkBleeding = true;
  let chkBreathing = true;
  let chkFracture = true;
  let chkSpine = false;
  let chkTrapped = true;
  let chkFire = false;
  let chkHazmat = false;

  let isSimulatingDispatch = false;
  let activeMultiResult = null;
  let dispatchPhase = '';
  let currentStep = 0;

  // Leaflet references
  let mapInstance = null;
  let markersLayer = null;
  let routeLayer = null;
  let activeBaseLayer = null;
  let multiMarkers = [];
  let multiIntervals = [];

  const tileLayerFactories = {
    osm: () =>
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c'],
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors | LIFEGRID',
      }),
    voyager: () =>
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution: '&copy; OpenStreetMap &copy; CARTO | LIFEGRID',
      }),
    topo: () =>
      L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        subdomains: ['a', 'b', 'c'],
        attribution: '&copy; OpenStreetMap contributors, SRTM | OpenTopoMap',
      }),
    satellite: () =>
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: '&copy; Esri &mdash; Earthstar Geographics | LIFEGRID',
      }),
  };

  const setMapTileStyle = (styleKey) => {
    currentMapStyle = styleKey;
    if (!mapInstance) return;
    if (activeBaseLayer) {
      mapInstance.removeLayer(activeBaseLayer);
    }
    const createLayer = tileLayerFactories[styleKey] || tileLayerFactories.osm;
    activeBaseLayer = createLayer();
    activeBaseLayer.on('tileerror', () => {
      if (styleKey !== 'osm') {
        console.warn(`Tile error on ${styleKey}, falling back to OpenStreetMap`);
        setMapTileStyle('osm');
      }
    });
    activeBaseLayer.addTo(mapInstance);
    activeBaseLayer.bringToBack();
  };

  const calculateEstimatedSeverity = () => {
    let score = 20;
    if (patientCount > 1) score += Math.min(30, patientCount * 6);
    if (unconsciousCount > 0) score += Math.min(25, unconsciousCount * 12);
    if (selectedTypes.includes('cardiac') || selectedTypes.includes('burn') || selectedTypes.includes('neuro')) score += 20;
    if (chkBleeding) score += 10;
    if (chkBreathing) score += 12;
    if (chkSpine) score += 10;
    if (chkTrapped) score += 8;
    if (chkFire || chkHazmat) score += 10;
    return Math.min(100, score);
  };

  const render = () => {
    const metrics = currentData?.metrics || {
      total_incidents: 0,
      active_emergencies: 0,
      available_ambulances: 0,
      total_ambulances: 0,
      referrals_in_transit: 0,
      facilities_monitored: 0,
    };
    const incidents = currentData?.incidents || [];
    const severityScore = calculateEstimatedSeverity();
    const severityLevel = severityScore >= 75 ? 'CRITICAL (P1)' : severityScore >= 50 ? 'HIGH (P2)' : 'MODERATE (P3)';
    const severityColor = severityScore >= 75 ? '#dc2626' : severityScore >= 50 ? '#ea580c' : '#16a34a';

    const filteredIncidents = incidents.filter((i) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchText = `${i.id} ${i.raw_symptoms} ${i.location?.address || ''}`.toLowerCase();
        if (!matchText.includes(q)) return false;
      }
      return true;
    });

    container.innerHTML = `
      <!-- Top Institutional Metrics Bar -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
        <div style="background-color: #ffffff; padding: 12px 16px; border-radius: 10px; border: 1px solid #e2e8f0; box-shadow: var(--shadow-sm);">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 0.74rem; font-weight: 700; color: #64748b;">ACTIVE EMERGENCIES</span>
            <i class="fa-solid fa-heart-pulse" style="color: #dc2626; font-size: 18px;"></i>
          </div>
          <div id="cc-metric-emergencies" style="font-size: 1.5rem; font-weight: 800; color: #0f172a; margin-top: 2px;">
            ${metrics.active_emergencies}
          </div>
          <div style="font-size: 0.7rem; color: #dc2626; font-weight: 600;">
            Real-time live monitoring
          </div>
        </div>

        <div style="background-color: #ffffff; padding: 12px 16px; border-radius: 10px; border: 1px solid #e2e8f0; box-shadow: var(--shadow-sm);">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 0.74rem; font-weight: 700; color: #64748b;">AMBULANCES READY</span>
            <i class="fa-solid fa-truck-medical" style="color: #0284c7; font-size: 18px;"></i>
          </div>
          <div id="cc-metric-ambulances" style="font-size: 1.5rem; font-weight: 800; color: #0f172a; margin-top: 2px;">
            ${metrics.available_ambulances} / ${metrics.total_ambulances}
          </div>
          <div style="font-size: 0.7rem; color: #0284c7; font-weight: 600;">
            15 Uttarakhand Units Online
          </div>
        </div>

        <div style="background-color: #ffffff; padding: 12px 16px; border-radius: 10px; border: 1px solid #e2e8f0; box-shadow: var(--shadow-sm);">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 0.74rem; font-weight: 700; color: #64748b;">HOSPITALS ACTIVE</span>
            <i class="fa-solid fa-building" style="color: #15803d; font-size: 18px;"></i>
          </div>
          <div id="cc-metric-facilities" style="font-size: 1.5rem; font-weight: 800; color: #0f172a; margin-top: 2px;">
            ${metrics.facilities_monitored || 113}
          </div>
          <div style="font-size: 0.7rem; color: #15803d; font-weight: 600;">
            GeoJSON Validated Facilities
          </div>
        </div>

        <div style="background-color: #ffffff; padding: 12px 16px; border-radius: 10px; border: 1px solid #e2e8f0; box-shadow: var(--shadow-sm);">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 0.74rem; font-weight: 700; color: #64748b;">REFERRALS CONTINUITY</span>
            <i class="fa-solid fa-share-nodes" style="color: #7e22ce; font-size: 18px;"></i>
          </div>
          <div id="cc-metric-referrals" style="font-size: 1.5rem; font-weight: 800; color: #0f172a; margin-top: 2px;">
            ${metrics.referrals_in_transit} In Transit
          </div>
          <div style="font-size: 0.7rem; color: #7e22ce; font-weight: 600;">
            3-Tier Context Synchronized
          </div>
        </div>
      </div>

      <!-- Main 3-Panel High-Tech Command Center Grid -->
      <div class="cc-grid">
        <!-- ============================================================
            PANEL 1 (LEFT): REPORT EMERGENCY FORM
            ============================================================ -->
        <aside class="cc-panel" style="max-height: 720px; overflow-y: auto;">
          <div class="cc-panel-header">
            <h2>
              <i class="fa-solid fa-triangle-exclamation" style="color: #dc2626;"></i>
              Report Emergency
            </h2>
            <span style="font-size: 0.68rem; background-color: #fee2e2; color: #b91c1c; padding: 2px 6px; border-radius: 4px; font-weight: 700;">
              LIVE DISPATCH
            </span>
          </div>

          <!-- Quick Scenario Preset Bench -->
          <div style="padding: 10px 14px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
            <div style="font-size: 0.68rem; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;">
              <i class="fa-solid fa-wand-magic-sparkles" style="color: #7e22ce;"></i>
              Quick Emergency Presets
            </div>
            <div style="display: flex; gap: 4px; flex-wrap: wrap;">
              <button type="button" class="btn-secondary js-cc-preset" data-preset="rajpur" style="font-size: 0.68rem; padding: 3px 6px;">
                🚌 Rajpur Crash (4)
              </button>
              <button type="button" class="btn-secondary js-cc-preset" data-preset="selaqui" style="font-size: 0.68rem; padding: 3px 6px;">
                🔥 Selaqui Fire (8)
              </button>
              <button type="button" class="btn-secondary js-cc-preset" data-preset="landslide" style="font-size: 0.68rem; padding: 3px 6px;">
                ⛰️ Landslide (12)
              </button>
              <button type="button" class="btn-secondary js-cc-preset" data-preset="ballupur" style="font-size: 0.68rem; padding: 3px 6px;">
                ❤️ Cardiac STEMI (1)
              </button>
            </div>
          </div>

          <!-- Incident Location Coordinates -->
          <div class="cc-form-section">
            <label class="cc-section-label">
              <i class="fa-solid fa-map-pin" style="color: #0284c7;"></i> Incident Location
            </label>
            <div class="cc-coord-row">
              <div class="cc-input-group">
                <label>Latitude</label>
                <input type="number" step="0.0001" id="cc-lat" value="${incidentPin.lat}">
              </div>
              <div class="cc-input-group">
                <label>Longitude</label>
                <input type="number" step="0.0001" id="cc-lng" value="${incidentPin.lng}">
              </div>
            </div>
            <div style="display: flex; gap: 6px;">
              <button type="button" id="btn-cc-gps" class="btn-secondary" style="flex: 1; padding: 4px 8px; font-size: 0.72rem; display: flex; align-items: center; justify-content: center; gap: 4px;">
                <i class="fa-solid fa-crosshairs" style="color: #0284c7;"></i> Use Device GPS
              </button>
              <button type="button" id="btn-cc-dehradun" class="btn-secondary" style="flex: 1; padding: 4px 8px; font-size: 0.72rem;">
                Dehradun Center
              </button>
            </div>
          </div>

          <!-- Casualties / Patient Count & Demographics -->
          <div class="cc-form-section">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <label class="cc-section-label">
                <i class="fa-solid fa-users" style="color: #2563eb;"></i> Casualties / Patients
              </label>
              <span style="font-size: 0.68rem; color: ${patientCount > 2 ? '#dc2626' : '#64748b'}; font-weight: 700;">
                ${patientCount > 2 ? '⚠️ Multi-Ambulance Required' : 'Single Ambulance'}
              </span>
            </div>

            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px;">
              ${[1, 2, 3, 4, 5, 6, 8, 10, 15, 20].map((num) => `
                <button
                  type="button"
                  class="js-patient-count-btn"
                  data-count="${num}"
                  style="
                    padding: 4px 0;
                    font-size: 0.72rem;
                    font-weight: ${patientCount === num ? 800 : 500};
                    background-color: ${patientCount === num ? '#1e40af' : '#f8fafc'};
                    color: ${patientCount === num ? '#ffffff' : '#334155'};
                    border: 1px solid ${patientCount === num ? '#1e40af' : '#cbd5e1'};
                    border-radius: 4px;
                    cursor: pointer;
                  "
                >
                  ${num}
                </button>
              `).join('')}
            </div>

            <div class="cc-coord-row" style="margin-top: 4px;">
              <div class="cc-input-group">
                <label>Exact Casualty Count (1 - 50+)</label>
                <input type="number" min="1" max="100" id="cc-count-input" value="${patientCount}">
              </div>
              <div class="cc-input-group">
                <label>Unconscious Victims</label>
                <input type="number" min="0" max="${patientCount}" id="cc-unconscious-input" value="${unconsciousCount}">
              </div>
            </div>

            <div class="cc-coord-row">
              <div class="cc-input-group">
                <label>Oldest Age</label>
                <input type="number" id="cc-oldest-age" value="${oldestAge}" placeholder="e.g. 68">
              </div>
              <div class="cc-input-group">
                <label>Youngest Age</label>
                <input type="number" id="cc-youngest-age" value="${youngestAge}" placeholder="e.g. 5">
              </div>
            </div>
          </div>

          <!-- Incident Type Grid (Multi-Select) -->
          <div class="cc-form-section">
            <label class="cc-section-label">
              <i class="fa-solid fa-car" style="color: #ea580c;"></i> Incident Category (Multi-Select)
            </label>
            <div class="cc-type-grid">
              ${INCIDENT_TYPES.map((t) => {
                const isActive = selectedTypes.includes(t.id);
                return `
                  <button
                    type="button"
                    class="cc-type-btn js-incident-type-btn ${isActive ? 'active' : ''}"
                    data-id="${t.id}"
                  >
                    <span style="font-size: 15px;">${t.icon}</span>
                    <span>${t.label}</span>
                  </button>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Emergency Indicators & Clinical Severity Checklist -->
          <div class="cc-form-section">
            <label class="cc-section-label">
              <i class="fa-solid fa-shield-halved" style="color: #dc2626;"></i> Emergency Indicators
            </label>

            <div class="cc-flag-group-title">Patient Condition</div>
            <label class="cc-checkbox-row">
              <input type="checkbox" id="chk-bleeding" ${chkBleeding ? 'checked' : ''}>
              <span>Severe Active Hemorrhage / Bleeding</span>
            </label>
            <label class="cc-checkbox-row">
              <input type="checkbox" id="chk-breathing" ${chkBreathing ? 'checked' : ''}>
              <span>Acute Airway / Breathing Difficulty</span>
            </label>
            <label class="cc-checkbox-row">
              <input type="checkbox" id="chk-fracture" ${chkFracture ? 'checked' : ''}>
              <span>Suspected Compound Fracture</span>
            </label>
            <label class="cc-checkbox-row">
              <input type="checkbox" id="chk-spine" ${chkSpine ? 'checked' : ''}>
              <span>Spinal / Cervical Immobilization Needed</span>
            </label>

            <div class="cc-flag-group-title">Scene Hazards</div>
            <label class="cc-checkbox-row">
              <input type="checkbox" id="chk-trapped" ${chkTrapped ? 'checked' : ''}>
              <span>Patient Trapped / Vehicle Extrication Required</span>
            </label>
            <label class="cc-checkbox-row">
              <input type="checkbox" id="chk-fire" ${chkFire ? 'checked' : ''}>
              <span>Active Fire / Toxic Smoke Hazard</span>
            </label>
            <label class="cc-checkbox-row">
              <input type="checkbox" id="chk-hazmat" ${chkHazmat ? 'checked' : ''}>
              <span>Hazardous Material / Chemical Spill</span>
            </label>
          </div>

          <!-- Description / Chief Complaint -->
          <div class="cc-form-section">
            <label class="cc-section-label">
              <i class="fa-solid fa-circle-info" style="color: #475569;"></i> Chief Complaint / Scene Description
            </label>
            <textarea
              id="cc-complaint-text"
              rows="2"
              style="
                width: 100%;
                padding: 6px 10px;
                border-radius: 6px;
                border: 1px solid #cbd5e1;
                font-size: 0.78rem;
                font-family: inherit;
                resize: vertical;
                outline: none;
              "
            >${incidentSymptoms}</textarea>
          </div>

          <!-- Severity Score Preview -->
          <div class="cc-severity-bar">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 0.72rem; font-weight: 700; color: #64748b;">ESTIMATED PRIORITY:</span>
              <strong id="cc-severity-level" style="font-size: 0.8rem; color: ${severityColor};">${severityLevel}</strong>
            </div>
            <div style="height: 7px; background-color: #e2e8f0; border-radius: 4px; overflow: hidden;">
              <div
                id="cc-severity-bar-fill"
                style="
                  height: 100%;
                  width: ${severityScore}%;
                  background-color: ${severityColor};
                  transition: width 0.4s ease;
                "
              ></div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.68rem; color: #64748b;">
              <span id="cc-acuity-text">Acuity Score: ${severityScore}/100</span>
              <span id="cc-matched-fleet-text">Matched Fleet: ${patientCount > 4 ? 'Multi-ALS/BLS Fleet' : 'ALS Dedicated'}</span>
            </div>
          </div>

          <!-- Dispatch Action Button -->
          <div style="padding: 12px 16px;">
            <button
              type="button"
              id="btn-cc-dispatch"
              ${isSimulatingDispatch ? 'disabled' : ''}
              style="
                width: 100%;
                background-color: #dc2626;
                color: #ffffff;
                border: none;
                border-radius: 8px;
                padding: 10px 14px;
                font-size: 0.85rem;
                font-weight: 800;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                box-shadow: 0 4px 12px rgba(220, 38, 38, 0.35);
              "
            >
              <i class="fa-solid fa-paper-plane"></i>
              ${isSimulatingDispatch
                ? 'Coordinating Fleet...'
                : `Dispatch Multi-Ambulance Fleet (${patientCount} Patient${patientCount > 1 ? 's' : ''})`}
            </button>
          </div>
        </aside>

        <!-- ============================================================
            PANEL 2 (CENTER): INTERACTIVE ROAD MAP & ETA COUNTER
            ============================================================ -->
        <section class="cc-panel" style="position: relative; display: flex; flex-direction: column;">
          <!-- Map Header with Region Switcher -->
          <div class="cc-panel-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <i class="fa-solid fa-satellite-dish" style="color: #15803d; font-size: 16px;"></i>
              <h3>Uttarakhand Dispatch Radar & Live Fleet</h3>
            </div>

            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <select
                id="cc-map-style-select"
                title="Select Map Tile Style"
                style="
                  font-size: 0.72rem;
                  font-weight: 600;
                  color: #0f172a;
                  padding: 3px 8px;
                  border-radius: 6px;
                  border: 1px solid #cbd5e1;
                  background-color: #ffffff;
                  cursor: pointer;
                "
              >
                <option value="osm" ${currentMapStyle === 'osm' ? 'selected' : ''}>🗺️ OpenStreetMap (Default)</option>
                <option value="voyager" ${currentMapStyle === 'voyager' ? 'selected' : ''}>🎨 CartoDB Voyager</option>
                <option value="topo" ${currentMapStyle === 'topo' ? 'selected' : ''}>⛰️ Topo / Terrain (Himalayan)</option>
                <option value="satellite" ${currentMapStyle === 'satellite' ? 'selected' : ''}>🛰️ Satellite Aerial</option>
              </select>

              <select
                id="cc-region-select"
                style="
                  font-size: 0.72rem;
                  font-weight: 600;
                  color: #0f172a;
                  padding: 3px 8px;
                  border-radius: 6px;
                  border: 1px solid #cbd5e1;
                  background-color: #ffffff;
                "
              >
                ${Object.entries(REGIONS).map(([key, reg]) => `
                  <option value="${key}" ${currentRegion === key ? 'selected' : ''}>
                    📍 ${reg.name}
                  </option>
                `).join('')}
              </select>

              <button
                type="button"
                id="btn-cc-refresh-all"
                class="btn-secondary"
                style="padding: 3px 8px; font-size: 0.72rem; display: flex; align-items: center; gap: 4px;"
              >
                <i class="fa-solid fa-rotate" style="font-size: 11px;"></i> Refresh
              </button>
            </div>
          </div>

          <!-- Floating Dispatch Progress / ETA Counter Banner -->
          <div
            id="cc-dispatch-banner"
            style="
              display: ${dispatchPhase ? 'flex' : 'none'};
              background-color: #eff6ff;
              border-bottom: 1px solid #bfdbfe;
              padding: 8px 14px;
              font-size: 0.78rem;
              color: #1e40af;
              font-weight: 700;
              align-items: center;
              gap: 8px;
              z-index: 10;
            "
          >
            <i class="fa-solid fa-location-arrow animate-spin"></i>
            <span id="cc-dispatch-phase-text">${dispatchPhase}</span>
          </div>

          <!-- Leaflet Map Div Container -->
          <div id="cc-map-container" style="flex: 1; min-height: 520px; width: 100%;"></div>

          <!-- Map Status Bar & Legend -->
          <div style="
            padding: 6px 14px;
            background-color: #f8fafc;
            border-top: 1px solid #e2e8f0;
            font-size: 0.72rem;
            color: #64748b;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 8px;
          ">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="display: flex; align-items: center; gap: 4px;">
                <span style="width: 8px; height: 8px; border-radius: 50%; background-color: #0284c7; display: inline-block;"></span>
                Ambulance (ALS/BLS)
              </span>
              <span style="display: flex; align-items: center; gap: 4px;">
                <span style="width: 8px; height: 8px; border-radius: 50%; background-color: #1e40af; display: inline-block;"></span>
                District / Super-Specialty
              </span>
              <span style="display: flex; align-items: center; gap: 4px;">
                <span style="width: 8px; height: 8px; border-radius: 50%; background-color: #15803d; display: inline-block;"></span>
                PHC / Rural Center
              </span>
              <span style="display: flex; align-items: center; gap: 4px;">
                <span style="width: 8px; height: 8px; border-radius: 50%; background-color: #dc2626; display: inline-block;"></span>
                Incident Target
              </span>
            </div>
            <div id="cc-pin-coords-text" style="font-weight: 600; color: #0f172a;">
              📍 Pin: ${incidentPin.lat.toFixed(4)}, ${incidentPin.lng.toFixed(4)}
            </div>
          </div>
        </section>

        <!-- ============================================================
            PANEL 3 (RIGHT): LIVE DISPATCH RESULTS & AI DIAGNOSTIC BENCH
            ============================================================ -->
        <aside class="cc-panel" style="max-height: 720px; overflow-y: auto;">
          <div class="cc-panel-header">
            <h2>
              <i class="fa-solid fa-wand-magic-sparkles" style="color: #7e22ce;"></i>
              Dispatch Result
            </h2>
            <span style="font-size: 0.68rem; background-color: #f1f5f9; color: #475569; padding: 2px 6px; border-radius: 4px; font-weight: 600;">
              AI MATCH
            </span>
          </div>

          <div id="cc-dispatch-results-container">
            ${renderDispatchResults()}
          </div>

          <!-- Selected Facility Details Card (when map hospital is clicked) -->
          <div id="cc-facility-details-container">
            ${renderFacilityDetails()}
          </div>
        </aside>
      </div>

      <!-- ============================================================
          BOTTOM SECTION: REAL-TIME INCIDENT LOG TABLE
          ============================================================ -->
      <div style="
        background-color: #ffffff;
        border-radius: 12px;
        border: 1px solid #e2e8f0;
        overflow: hidden;
        box-shadow: var(--shadow-sm);
      ">
        <div style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-heart-pulse" style="color: #b91c1c; font-size: 16px;"></i>
            <h3 style="font-size: 0.88rem; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase;">
              Real-Time Incident Log & Pan-India Dispatch Feed
            </h3>
          </div>

          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="position: relative;">
              <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 10px; top: 8px; font-size: 13px; color: #94a3b8;"></i>
              <input
                type="text"
                id="cc-log-search"
                placeholder="Search logs..."
                value="${searchQuery}"
                style="
                  padding: 4px 10px 4px 28px;
                  border-radius: 6px;
                  border: 1px solid #cbd5e1;
                  font-size: 0.75rem;
                  outline: none;
                "
              />
            </div>
            <button type="button" id="btn-cc-refresh-logs" class="btn-secondary" style="padding: 4px 8px; font-size: 0.72rem;">
              <i class="fa-solid fa-rotate" style="font-size: 11px;"></i> Refresh Log
            </button>
          </div>
        </div>

        <div style="overflow-x: auto;">
          <table class="cc-log-table">
            <thead>
              <tr>
                <th>#ID</th>
                <th>Time</th>
                <th>Location</th>
                <th>Chief Complaint / Symptoms</th>
                <th>Status</th>
                <th>Triage Priority</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="cc-log-table-body">
              ${renderLogTableRows()}
            </tbody>
          </table>
        </div>
      </div>
    `;

    initMap();
    bindEvents();
  };

  const renderDispatchResults = () => {
    if (!activeMultiResult) {
      return `
        <div style="padding: 40px 20px; text-align: center; color: #64748b; display: flex; flex-direction: column; align-items: center; gap: 10px;">
          <i class="fa-solid fa-satellite-dish" style="font-size: 36px; color: #94a3b8;"></i>
          <p style="font-weight: 600; font-size: 0.88rem; color: #334155; margin: 0;">Awaiting Emergency Report...</p>
          <p style="font-size: 0.74rem; margin: 0;">
            Click anywhere on the map or choose a preset on the left, then click <strong>Dispatch Multi-Ambulance Fleet</strong>.
          </p>
        </div>
      `;
    }

    const assignments = activeMultiResult.assignments || [];
    const ROUTE_COLORS = ['#dc2626', '#0284c7', '#7e22ce', '#059669', '#ea580c', '#d97706'];

    return `
      <div style="padding: 12px 14px; display: flex; flex-direction: column; gap: 12px;">
        <!-- Summary Severity Banner -->
        <div style="
          background-color: #fee2e2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          padding: 10px 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <div>
            <div style="font-size: 0.68rem; font-weight: 700; color: #991b1b; text-transform: uppercase;">
              Triaged Severity & Load
            </div>
            <div style="font-size: 1rem; font-weight: 800; color: #b91c1c;">
              ${activeMultiResult.total_patients} Casualty(ies) · ${activeMultiResult.ambulances_dispatched} Unit(s)
            </div>
          </div>
          <div style="text-align: right;">
            <span style="font-size: 0.68rem; background-color: #b91c1c; color: #ffffff; padding: 2px 8px; border-radius: 12px; font-weight: 700;">
              CODE RED
            </span>
          </div>
        </div>

        <div style="font-size: 0.72rem; font-weight: 700; color: #475569; text-transform: uppercase;">
          Dispatched Fleet Allocation
        </div>

        ${assignments.map((asgn, idx) => {
          const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
          return `
            <div style="
              background-color: #ffffff;
              border: 1px solid ${color}40;
              border-left: 4px solid ${color};
              border-radius: 8px;
              padding: 10px;
              box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            ">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
                <div>
                  <strong style="font-size: 0.82rem; color: #0f172a;">
                    🚑 ${asgn.ambulance.vehicle_number}
                  </strong>
                  <div style="font-size: 0.68rem; color: #64748b;">
                    Driver: ${asgn.ambulance.driver_name} · Paramedic: ${asgn.ambulance.paramedic_name}
                  </div>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 0.92rem; font-weight: 800; color: ${color}; font-family: monospace;">
                    ${asgn.total_eta_min}m
                  </div>
                  <div style="font-size: 0.64rem; color: #64748b;">TOTAL ETA</div>
                </div>
              </div>

              <!-- Passenger Manifest -->
              <div style="background-color: #f8fafc; padding: 6px 8px; border-radius: 4px; margin: 6px 0; font-size: 0.7rem;">
                <strong style="color: #0f172a;">Passengers (${asgn.passengers.length}):</strong>
                ${asgn.passengers.map((p) => `
                  <div style="margin-top: 2px; color: #1e293b;">
                    • <strong style="color: ${p.priority === 'P1' ? '#dc2626' : '#0284c7'};">[${p.priority}] ${p.patient_id}:</strong> ${p.condition}
                  </div>
                `).join('')}
              </div>

              <!-- Designated Hospital -->
              <div style="font-size: 0.72rem; color: #0f172a;">
                🏥 Designated: <strong style="color: #15803d;">${asgn.designated_hospital.name}</strong>
              </div>
              <div style="font-size: 0.68rem; color: #64748b; margin-top: 2px;">
                ${asgn.hospital_match_reason}
              </div>
            </div>
          `;
        }).join('')}

        <!-- Progress Timeline -->
        <div style="background-color: #f8fafc; border-radius: 8px; padding: 10px 12px; border: 1px solid #e2e8f0; margin-top: 4px;">
          <div style="font-size: 0.72rem; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 8px;">
            Live Dispatch Milestone Timeline
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px; font-size: 0.72rem;">
            <div style="display: flex; align-items: center; gap: 8px; color: #15803d; font-weight: 600;">
              <i class="fa-solid fa-circle-check"></i>
              <span>1. Emergency Reported & Triage Completed</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; color: ${currentStep >= 1 ? '#0284c7' : '#94a3b8'}; font-weight: ${currentStep >= 1 ? 700 : 400};">
              <i class="fa-solid ${currentStep >= 1 ? 'fa-circle-check' : 'fa-clock'}"></i>
              <span>2. Units Dispatched along OSRM Road Route</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; color: ${currentStep >= 2 ? '#0284c7' : '#94a3b8'}; font-weight: ${currentStep >= 2 ? 700 : 400};">
              <i class="fa-solid ${currentStep >= 2 ? 'fa-circle-check' : 'fa-clock'}"></i>
              <span>3. Converged on Scene & Loaded Patients</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; color: ${currentStep >= 3 ? '#15803d' : '#94a3b8'}; font-weight: ${currentStep >= 3 ? 700 : 400};">
              <i class="fa-solid ${currentStep >= 3 ? 'fa-circle-check' : 'fa-clock'}"></i>
              <span>4. Delivered to Designated Trauma Centers</span>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  const renderFacilityDetails = () => {
    if (!selectedFacility) return '';
    return `
      <div style="
        margin: 10px 14px;
        padding: 12px;
        background-color: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        font-size: 0.75rem;
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <strong style="font-size: 0.84rem; color: #0f172a;">🏥 ${selectedFacility.name}</strong>
          <button
            type="button"
            id="btn-close-facility-card"
            style="border: none; background: none; color: #64748b; cursor: pointer; font-size: 11px; padding: 0 4px;"
          >
            ✕
          </button>
        </div>
        <div style="color: #475569; margin-bottom: 4px;">
          Tier: <strong>${(selectedFacility.tier || '').replace('_', ' ').toUpperCase()}</strong> · Beds: <strong>${selectedFacility.beds_available}/${selectedFacility.bed_capacity}</strong>
        </div>
        <div style="color: #0369a1; margin-bottom: 2px;">
          ICU Available: <strong>${selectedFacility.available_icu || 2}/${selectedFacility.icu_beds || 10}</strong>
        </div>
        <div style="color: #64748b; font-size: 0.7rem;">
          Capabilities: ${(selectedFacility.capability_tags || []).join(', ') || 'General Medicine'}
        </div>
      </div>
    `;
  };

  const updateSeverityPreview = () => {
    const score = calculateEstimatedSeverity();
    const level = score >= 75 ? 'CRITICAL (P1)' : score >= 50 ? 'HIGH (P2)' : 'MODERATE (P3)';
    const color = score >= 75 ? '#dc2626' : score >= 50 ? '#ea580c' : '#16a34a';

    const levelEl = container.querySelector('#cc-severity-level');
    const barEl = container.querySelector('#cc-severity-bar-fill');
    const acuityEl = container.querySelector('#cc-acuity-text');
    const fleetEl = container.querySelector('#cc-matched-fleet-text');

    if (levelEl) {
      levelEl.textContent = level;
      levelEl.style.color = color;
    }
    if (barEl) {
      barEl.style.width = `${score}%`;
      barEl.style.backgroundColor = color;
    }
    if (acuityEl) acuityEl.textContent = `Acuity Score: ${score}/100`;
    if (fleetEl) fleetEl.textContent = `Matched Fleet: ${patientCount > 4 ? 'Multi-ALS/BLS Fleet' : 'ALS Dedicated'}`;
  };

  const renderLogTableRows = () => {
    const incidents = currentData?.incidents || [];
    const filteredIncidents = incidents.filter((i) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchText = `${i.id} ${i.raw_symptoms} ${i.location?.address || ''}`.toLowerCase();
        if (!matchText.includes(q)) return false;
      }
      return true;
    });

    if (filteredIncidents.length === 0) {
      return `
        <tr>
          <td colspan="7" style="text-align: center; padding: 24px; color: #64748b;">
            No recorded emergency incidents matching criteria. Report an emergency above or trigger a preset scenario.
          </td>
        </tr>
      `;
    }

    return filteredIncidents.map((inc) => {
      const isSelected = selectedIncident && selectedIncident.id === inc.id;
      return `
        <tr
          class="js-cc-log-row"
          data-id="${inc.id}"
          style="background-color: ${isSelected ? '#eff6ff' : 'transparent'}; cursor: pointer;"
        >
          <td style="font-family: monospace; font-weight: 700; color: #0f172a;">
            #${inc.id.slice(0, 6)}
          </td>
          <td style="color: #64748b; font-size: 0.72rem;">
            ${new Date(inc.created_at || Date.now()).toLocaleTimeString()}
          </td>
          <td>
            📍 ${inc.location?.address || `${inc.location?.latitude?.toFixed(4)}, ${inc.location?.longitude?.toFixed(4)}`}
          </td>
          <td style="max-width: 320px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500;">
            ${inc.raw_symptoms}
          </td>
          <td>
            <span style="
              font-size: 0.68rem;
              font-weight: 700;
              padding: 2px 6px;
              border-radius: 4px;
              background-color: ${inc.status === 'dispatched' ? '#e0f2fe' : '#fee2e2'};
              color: ${inc.status === 'dispatched' ? '#0369a1' : '#b91c1c'};
            ">
              ${(inc.status || 'REPORTED').toUpperCase()}
            </span>
          </td>
          <td>
            <span style="font-weight: 800; color: #dc2626;">P1 CRITICAL</span>
          </td>
          <td>
            <button
              type="button"
              class="btn-secondary js-explain-incident-btn"
              data-triage-id="${inc.triage_result_id || ''}"
              style="
                font-size: 0.72rem;
                padding: 2px 6px;
                display: inline-flex;
                align-items: center;
                gap: 4px;
                color: #4338ca;
                border-color: #c7d2fe;
                background-color: #eef2ff;
              "
            >
              <i class="fa-solid fa-wand-magic-sparkles"></i>
              Explain AI
            </button>
          </td>
        </tr>
      `;
    }).join('');
  };

  const updateFormControls = () => {
    const latInput = container.querySelector('#cc-lat');
    const lngInput = container.querySelector('#cc-lng');
    const coordsText = container.querySelector('#cc-pin-coords-text');
    const complaintText = container.querySelector('#cc-complaint-text');
    const countInput = container.querySelector('#cc-count-input');
    const unconcInput = container.querySelector('#cc-unconscious-input');
    const oldestAgeInput = container.querySelector('#cc-oldest-age');
    const youngestAgeInput = container.querySelector('#cc-youngest-age');
    const dispatchBtn = container.querySelector('#btn-cc-dispatch');

    if (latInput) latInput.value = incidentPin.lat;
    if (lngInput) lngInput.value = incidentPin.lng;
    if (coordsText) coordsText.textContent = `📍 Pin: ${incidentPin.lat.toFixed(4)}, ${incidentPin.lng.toFixed(4)}`;
    if (complaintText) complaintText.value = incidentSymptoms;
    if (countInput) countInput.value = patientCount;
    if (unconcInput) unconcInput.value = unconsciousCount;
    if (oldestAgeInput) oldestAgeInput.value = oldestAge || '';
    if (youngestAgeInput) youngestAgeInput.value = youngestAge || '';

    // Update patient count buttons
    container.querySelectorAll('.js-patient-count-btn').forEach((btn) => {
      const num = parseInt(btn.getAttribute('data-count'), 10);
      const isSelected = patientCount === num;
      btn.style.fontWeight = isSelected ? '800' : '500';
      btn.style.backgroundColor = isSelected ? '#1e40af' : '#f8fafc';
      btn.style.color = isSelected ? '#ffffff' : '#334155';
      btn.style.borderColor = isSelected ? '#1e40af' : '#cbd5e1';
    });

    // Update incident type buttons
    container.querySelectorAll('.js-incident-type-btn').forEach((btn) => {
      const id = btn.getAttribute('data-id');
      if (selectedTypes.includes(id)) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update checkboxes
    const setChk = (id, val) => {
      const el = container.querySelector(id);
      if (el) el.checked = Boolean(val);
    };
    setChk('#chk-bleeding', chkBleeding);
    setChk('#chk-breathing', chkBreathing);
    setChk('#chk-fracture', chkFracture);
    setChk('#chk-spine', chkSpine);
    setChk('#chk-trapped', chkTrapped);
    setChk('#chk-fire', chkFire);
    setChk('#chk-hazmat', chkHazmat);

    if (dispatchBtn && !isSimulatingDispatch) {
      dispatchBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Dispatch Multi-Ambulance Fleet (${patientCount} Patient${patientCount > 1 ? 's' : ''})`;
    }

    updateSeverityPreview();
    refreshMapMarkers();
  };

  const initMap = () => {
    const mapDiv = container.querySelector('#cc-map-container');
    if (!mapDiv || typeof L === 'undefined') return;

    // Check if mapInstance exists on a detached/different container
    if (mapInstance) {
      if (mapInstance.getContainer() !== mapDiv) {
        try {
          mapInstance.remove();
        } catch (e) {}
        mapInstance = null;
        markersLayer = null;
        routeLayer = null;
      }
    }

    if (mapDiv._leaflet_id && !mapInstance) {
      delete mapDiv._leaflet_id;
    }

    if (!mapInstance) {
      mapInstance = L.map(mapDiv, {
        center: REGIONS[currentRegion].center,
        zoom: REGIONS[currentRegion].zoom,
        zoomControl: true,
      });

      setMapTileStyle(currentMapStyle);

      markersLayer = L.layerGroup().addTo(mapInstance);
      routeLayer = L.layerGroup().addTo(mapInstance);

      mapInstance.on('click', (e) => {
        incidentPin = {
          lat: Number(e.latlng.lat.toFixed(4)),
          lng: Number(e.latlng.lng.toFixed(4)),
        };
        const latInput = container.querySelector('#cc-lat');
        const lngInput = container.querySelector('#cc-lng');
        const coordsText = container.querySelector('#cc-pin-coords-text');
        if (latInput) latInput.value = incidentPin.lat;
        if (lngInput) lngInput.value = incidentPin.lng;
        if (coordsText) coordsText.textContent = `📍 Pin: ${incidentPin.lat.toFixed(4)}, ${incidentPin.lng.toFixed(4)}`;
        refreshMapMarkers();
      });

      // ResizeObserver to ensure tiles render immediately when layout shifts
      if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => {
          if (mapInstance) {
            mapInstance.invalidateSize();
          }
        });
        ro.observe(mapDiv);
      }
    } else {
      mapInstance.invalidateSize();
    }

    setTimeout(() => {
      if (mapInstance) mapInstance.invalidateSize();
    }, 150);

    refreshMapMarkers();
  };

  const refreshMapMarkers = () => {
    if (!mapInstance || !markersLayer) return;
    markersLayer.clearLayers();

    const hospitals = currentData?.hospitals || [];
    const incidents = currentData?.incidents || [];
    const fleet = currentData?.ambulances || [];

    // 1. Facilities
    hospitals.forEach((h) => {
      const isDistrict = h.tier === 'district_hospital';
      const colorClass = isDistrict ? 'map-marker--blue' : 'map-marker--teal';

      const icon = L.divIcon({
        className: '',
        html: `
          <div class="map-marker ${colorClass}" title="${h.name}">
            <i class="fa-solid fa-hospital"></i>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([h.location.latitude, h.location.longitude], { icon })
        .bindPopup(`
          <div style="font-family: sans-serif; min-width: 190px;">
            <strong style="font-size: 13px; color: #0f172a;">${h.name}</strong><br/>
            <span style="font-size: 11px; color: #64748b; font-weight: 600;">${(h.tier || '').replace('_', ' ').toUpperCase()}</span><br/>
            <div style="margin-top: 6px; font-size: 12px; color: #1e293b;">
              General Beds: <strong>${h.beds_available}/${h.bed_capacity}</strong><br/>
              ICU Beds: <strong style="color: #b91c1c;">${h.available_icu || 2}/${h.icu_beds || 10}</strong><br/>
              Status: <strong>${h.accessibility_status}</strong>
            </div>
          </div>
        `);

      marker.on('click', () => {
        selectedFacility = h;
        selectedIncident = null;
        const facContainer = container.querySelector('#cc-facility-details-container');
        if (facContainer) facContainer.innerHTML = renderFacilityDetails();
        bindFacilityEvents();
      });

      markersLayer.addLayer(marker);
    });

    // 2. Incidents
    incidents.forEach((inc) => {
      const icon = L.divIcon({
        className: '',
        html: `
          <div class="map-marker map-marker--orange" title="Incident #${inc.id.slice(0, 6)}">
            <i class="fa-solid fa-circle-exclamation"></i>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([inc.location.latitude, inc.location.longitude], { icon })
        .bindPopup(`
          <div style="font-family: sans-serif; min-width: 180px;">
            <strong style="font-size: 13px;">Emergency #${inc.id.slice(0, 6)}</strong><br/>
            <span style="font-size: 11px; color: #dc2626; font-weight: bold;">${(inc.status || 'REPORTED').toUpperCase()}</span><br/>
            <p style="margin-top: 4px; font-size: 12px; color: #334155;">${inc.raw_symptoms.slice(0, 60)}...</p>
          </div>
        `);

      marker.on('click', () => {
        selectedIncident = inc;
        selectedFacility = null;
        const facContainer = container.querySelector('#cc-facility-details-container');
        if (facContainer) facContainer.innerHTML = renderFacilityDetails();
      });

      markersLayer.addLayer(marker);
    });

    // 3. Fleet
    fleet.forEach((amb) => {
      const isAvailable = amb.status === 'available';
      const colorClass = isAvailable ? 'map-marker--green' : 'map-marker--red';

      const icon = L.divIcon({
        className: '',
        html: `
          <div class="map-marker ${colorClass}" title="${amb.vehicle_number}">
            <i class="fa-solid fa-truck-medical"></i>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([amb.current_location.latitude, amb.current_location.longitude], { icon })
        .bindPopup(`
          <div style="font-family: sans-serif;">
            <strong style="font-size: 12px; color: #0f172a;">${amb.vehicle_number}</strong><br/>
            <span style="font-size: 11px;">Status: <b>${(amb.status || 'AVAILABLE').toUpperCase()}</b></span><br/>
            <span style="font-size: 11px; color: #64748b;">Tags: ${(amb.capability_tags || []).join(', ')}</span><br/>
            <span style="font-size: 11px;">Capacity: <b>${amb.capacity || 1} patient(s)</b></span>
          </div>
        `);

      marker.on('click', () => {
        openAmbulance3DViewer({
          id: amb.id,
          name: amb.vehicle_number,
          type: (amb.capability_tags || []).includes('ALS') ? 'ALS' : 'BLS',
          model: 'Force Traveller Medical',
          license_plate: amb.vehicle_number,
          status: amb.status,
          equipment: amb.capability_tags,
        });
      });

      markersLayer.addLayer(marker);
    });

    // 4. Target Incident Pin
    const pinIcon = L.divIcon({
      className: 'target-pin-icon',
      html: `
        <div style="width: 34px; height: 34px; background-color: #dc2626; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 2.5px solid white; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.6);">
          <div style="transform: rotate(45deg); font-size: 14px; color: white; font-weight: bold;">📍</div>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 34],
    });

    const incidentMarker = L.marker([incidentPin.lat, incidentPin.lng], { icon: pinIcon })
      .bindPopup(`<b>Reported Incident Target</b><br/>Lat: ${incidentPin.lat.toFixed(4)}, Lng: ${incidentPin.lng.toFixed(4)}<br/><span style="color:#64748b;font-size:11px;">Click map anywhere to relocate</span>`);
    markersLayer.addLayer(incidentMarker);
  };

  const bindFacilityEvents = () => {
    const closeFacBtn = container.querySelector('#btn-close-facility-card');
    if (closeFacBtn) {
      closeFacBtn.addEventListener('click', () => {
        selectedFacility = null;
        const facContainer = container.querySelector('#cc-facility-details-container');
        if (facContainer) facContainer.innerHTML = '';
      });
    }
  };

  const bindEvents = () => {
    // Preset Buttons
    container.querySelectorAll('.js-cc-preset').forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-preset');
        if (type === 'rajpur') {
          patientCount = 4;
          unconsciousCount = 2;
          incidentSymptoms = 'Highway collision on Rajpur Road: 4 casualties with critical cardiac shock, intracranial hemorrhage, femur fractures, and chest trauma';
          selectedTypes = ['road', 'cardiac'];
          incidentPin = { lat: 30.3398, lng: 78.0644 };
          chkBleeding = true;
          chkBreathing = true;
          chkTrapped = true;
          chkFire = false;
        } else if (type === 'selaqui') {
          patientCount = 8;
          unconsciousCount = 3;
          incidentSymptoms = 'Industrial chemical flash fire in Selaqui pharmaceutical factory: 8 casualties with severe 3rd-degree burns and acute smoke inhalation';
          selectedTypes = ['burn', 'breathing'];
          incidentPin = { lat: 30.3685, lng: 77.8540 };
          chkBreathing = true;
          chkTrapped = false;
          chkFire = true;
        } else if (type === 'landslide') {
          patientCount = 12;
          unconsciousCount = 4;
          incidentSymptoms = 'Tourist van caught in Mussoorie bypass landslide: 12 casualties with blunt polytrauma, limb amputations, and trapped victims';
          selectedTypes = ['fall', 'road'];
          incidentPin = { lat: 30.4598, lng: 78.0644 };
          chkBleeding = true;
          chkTrapped = true;
          chkFire = false;
        } else if (type === 'ballupur') {
          patientCount = 1;
          unconsciousCount = 1;
          incidentSymptoms = 'Acute STEMI cardiac arrest at Ballupur Chowk with pulmonary edema and unconsciousness';
          selectedTypes = ['cardiac'];
          incidentPin = { lat: 30.3350, lng: 78.0120 };
          chkBreathing = true;
          chkTrapped = false;
          chkFire = false;
        }

        if (mapInstance) {
          mapInstance.flyTo([incidentPin.lat, incidentPin.lng], 13, { duration: 1 });
        }
        updateFormControls();
      });
    });

    // GPS Buttons
    const gpsBtn = container.querySelector('#btn-cc-gps');
    if (gpsBtn) {
      gpsBtn.addEventListener('click', () => {
        if (!navigator.geolocation) {
          alert('Geolocation not supported by browser. Using default Dehradun location.');
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            incidentPin = {
              lat: Number(pos.coords.latitude.toFixed(4)),
              lng: Number(pos.coords.longitude.toFixed(4)),
            };
            if (mapInstance) mapInstance.flyTo([incidentPin.lat, incidentPin.lng], 14, { duration: 1 });
            updateFormControls();
          },
          () => {
            alert('GPS permission denied. Setting Dehradun clock tower center.');
            incidentPin = { lat: 30.3255, lng: 78.0436 };
            if (mapInstance) mapInstance.flyTo([30.3255, 78.0436], 13);
            updateFormControls();
          }
        );
      });
    }

    const dehradunBtn = container.querySelector('#btn-cc-dehradun');
    if (dehradunBtn) {
      dehradunBtn.addEventListener('click', () => {
        incidentPin = { lat: 30.3255, lng: 78.0436 };
        if (mapInstance) mapInstance.flyTo([30.3255, 78.0436], 13);
        updateFormControls();
      });
    }

    // Coordinates inputs
    const latInput = container.querySelector('#cc-lat');
    const lngInput = container.querySelector('#cc-lng');
    if (latInput) {
      latInput.addEventListener('input', (e) => {
        incidentPin.lat = parseFloat(e.target.value) || 0;
        refreshMapMarkers();
      });
    }
    if (lngInput) {
      lngInput.addEventListener('input', (e) => {
        incidentPin.lng = parseFloat(e.target.value) || 0;
        refreshMapMarkers();
      });
    }

    // Patient counts
    container.querySelectorAll('.js-patient-count-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        patientCount = parseInt(btn.getAttribute('data-count'), 10);
        updateFormControls();
      });
    });

    const countInput = container.querySelector('#cc-count-input');
    if (countInput) {
      countInput.addEventListener('input', (e) => {
        patientCount = Math.max(1, parseInt(e.target.value, 10) || 1);
        updateSeverityPreview();
      });
    }

    const unconcInput = container.querySelector('#cc-unconscious-input');
    if (unconcInput) {
      unconcInput.addEventListener('input', (e) => {
        unconsciousCount = Math.max(0, parseInt(e.target.value, 10) || 0);
        updateSeverityPreview();
      });
    }

    // Incident types
    container.querySelectorAll('.js-incident-type-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const exists = selectedTypes.includes(id);
        selectedTypes = exists ? selectedTypes.filter((t) => t !== id) : [...selectedTypes, id];
        if (selectedTypes.length === 0) selectedTypes = [id];

        const found = INCIDENT_TYPES.find((t) => t.id === id);
        if (!exists && found) {
          incidentSymptoms = `${found.defaultDesc} (${patientCount} casualty/ies reported)`;
        }
        updateFormControls();
      });
    });

    // Checkboxes
    const bindChk = (id, getter, setter) => {
      const el = container.querySelector(id);
      if (el) {
        el.addEventListener('change', (e) => {
          setter(e.target.checked);
          updateSeverityPreview();
        });
      }
    };
    bindChk('#chk-bleeding', () => chkBleeding, (v) => { chkBleeding = v; });
    bindChk('#chk-breathing', () => chkBreathing, (v) => { chkBreathing = v; });
    bindChk('#chk-fracture', () => chkFracture, (v) => { chkFracture = v; });
    bindChk('#chk-spine', () => chkSpine, (v) => { chkSpine = v; });
    bindChk('#chk-trapped', () => chkTrapped, (v) => { chkTrapped = v; });
    bindChk('#chk-fire', () => chkFire, (v) => { chkFire = v; });
    bindChk('#chk-hazmat', () => chkHazmat, (v) => { chkHazmat = v; });

    const complaintInput = container.querySelector('#cc-complaint-text');
    if (complaintInput) {
      complaintInput.addEventListener('input', (e) => {
        incidentSymptoms = e.target.value;
      });
    }

    // Dispatch Trigger
    const dispatchBtn = container.querySelector('#btn-cc-dispatch');
    if (dispatchBtn) {
      dispatchBtn.addEventListener('click', handleTriggerDispatch);
    }

    // Map Style Select
    const mapStyleSelect = container.querySelector('#cc-map-style-select');
    if (mapStyleSelect) {
      mapStyleSelect.addEventListener('change', (e) => {
        setMapTileStyle(e.target.value);
      });
    }

    // Region Select
    const regionSelect = container.querySelector('#cc-region-select');
    if (regionSelect) {
      regionSelect.addEventListener('change', (e) => {
        currentRegion = e.target.value;
        const reg = REGIONS[currentRegion];
        if (mapInstance && reg) {
          mapInstance.flyTo(reg.center, reg.zoom, { duration: 1.2 });
          incidentPin = { lat: reg.center[0], lng: reg.center[1] };
          const coordsText = container.querySelector('#cc-pin-coords-text');
          if (coordsText) coordsText.textContent = `📍 Pin: ${incidentPin.lat.toFixed(4)}, ${incidentPin.lng.toFixed(4)}`;
          refreshMapMarkers();
        }
      });
    }

    // Refresh Buttons
    const refreshAllBtn = container.querySelector('#btn-cc-refresh-all');
    if (refreshAllBtn) refreshAllBtn.addEventListener('click', onRefresh);

    const refreshLogsBtn = container.querySelector('#btn-cc-refresh-logs');
    if (refreshLogsBtn) refreshLogsBtn.addEventListener('click', onRefresh);

    // Search Log
    const searchInput = container.querySelector('#cc-log-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        const tbody = container.querySelector('#cc-log-table-body');
        if (tbody) {
          tbody.innerHTML = renderLogTableRows();
          bindLogTableEvents();
        }
      });
    }

    bindLogTableEvents();
    bindFacilityEvents();
  };

  const bindLogTableEvents = () => {
    // Incident row selection
    container.querySelectorAll('.js-cc-log-row').forEach((row) => {
      row.addEventListener('click', () => {
        const id = row.getAttribute('data-id');
        const inc = (currentData?.incidents || []).find((i) => i.id === id);
        if (inc) {
          selectedIncident = inc;
          if (mapInstance) {
            mapInstance.flyTo([inc.location.latitude, inc.location.longitude], 14, { duration: 1 });
          }
          container.querySelectorAll('.js-cc-log-row').forEach((r) => {
            r.style.backgroundColor = r.getAttribute('data-id') === id ? '#eff6ff' : 'transparent';
          });
        }
      });
    });

    // Explain AI in log rows
    container.querySelectorAll('.js-explain-incident-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const triageId = btn.getAttribute('data-triage-id');
        if (!triageId) return;
        try {
          const trace = await fetchTriageById(triageId);
          openExplainabilityModal({
            trace,
            canOverride: userRole !== 'citizen',
            onOpenOverride: () => {
              openOverrideModal({
                triageId: trace.triage_id,
                currentPriority: trace.priority || 'P1',
                userRole,
                onSuccess: () => onRefresh(),
              });
            },
          });
        } catch (err) {
          console.error('Failed to load triage trace', err);
        }
      });
    });

    bindFacilityEvents();
  };

  const handleTriggerDispatch = async () => {
    try {
      isSimulatingDispatch = true;
      currentStep = 1;
      dispatchPhase = `Querying OSRM road geometry & allocating emergency units for ${patientCount} casualty(ies)...`;

      // Clear existing animated markers & timers
      multiMarkers.forEach((m) => mapInstance?.removeLayer(m));
      multiMarkers = [];
      multiIntervals.forEach((i) => clearInterval(i));
      multiIntervals = [];

      if (routeLayer) routeLayer.clearLayers();

      const banner = container.querySelector('#cc-dispatch-banner');
      const phaseText = container.querySelector('#cc-dispatch-phase-text');
      if (banner) banner.style.display = 'flex';
      if (phaseText) phaseText.textContent = dispatchPhase;
      if (mapInstance) {
        setTimeout(() => mapInstance.invalidateSize(), 50);
      }

      const multiResult = await executeMultiDispatch({
        incident_location: { latitude: incidentPin.lat, longitude: incidentPin.lng },
        patient_count: patientCount,
        chief_complaint: incidentSymptoms,
      });

      activeMultiResult = multiResult;
      const assignments = multiResult.assignments || [];
      const ROUTE_COLORS = ['#dc2626', '#0284c7', '#7e22ce', '#059669', '#ea580c', '#d97706'];

      dispatchPhase = `Dispatched ${multiResult.ambulances_dispatched} unit(s) for ${multiResult.total_patients} patient(s). Following road geometry to incident scene...`;
      if (phaseText) phaseText.textContent = dispatchPhase;

      const resultsContainer = container.querySelector('#cc-dispatch-results-container');
      if (resultsContainer) resultsContainer.innerHTML = renderDispatchResults();

      assignments.forEach((asgn, idx) => {
        const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
        const scenePts = asgn.route_to_scene || [];
        const hospPts = asgn.route_to_hospital || [];

        if (routeLayer) {
          const line1 = L.polyline(scenePts, {
            color,
            weight: 4.5,
            opacity: 0.9,
            dashArray: '8, 6',
          });
          const line2 = L.polyline(hospPts, {
            color,
            weight: 4.5,
            opacity: 0.95,
          });
          routeLayer.addLayer(line1);
          routeLayer.addLayer(line2);
        }

        const ambIcon = L.divIcon({
          className: `multi-amb-${idx}`,
          html: `
            <div style="background-color: ${color}; border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; border: 2.5px solid white; box-shadow: 0 0 12px ${color}; cursor: pointer;" title="${asgn.ambulance.vehicle_number}">
              <span style="font-size: 14px;">🚑</span>
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });

        const startPt = scenePts[0] || [asgn.ambulance.current_location.latitude, asgn.ambulance.current_location.longitude];
        const ambMarker = L.marker(startPt, { icon: ambIcon }).addTo(routeLayer);
        multiMarkers.push(ambMarker);

        ambMarker.bindPopup(`
          <div style="font-family: sans-serif; min-width: 210px;">
            <strong style="color: ${color}; font-size: 13px;">${asgn.ambulance.vehicle_number}</strong><br/>
            <span style="font-size: 11px; color: #475569;">Driver: ${asgn.ambulance.driver_name} | Paramedic: ${asgn.ambulance.paramedic_name}</span><br/>
            <hr style="margin: 5px 0; border: none; border-top: 1px solid #e2e8f0;"/>
            <div style="font-size: 11px;">
              <strong>Assigned Patients (${asgn.passengers.length}):</strong><br/>
              ${asgn.passengers.map((p) => `• [${p.priority}] ${p.patient_id}: ${p.condition}`).join('<br/>')}
            </div>
            <div style="margin-top: 5px; font-size: 11.5px; color: #15803d; font-weight: 700;">
              ➔ Hospital: ${asgn.designated_hospital.name} (Road ETA: ${asgn.total_eta_min}m)
            </div>
          </div>
        `);

        const fullTrajectory = [...scenePts, ...hospPts];
        let stepIdx = 0;
        const totalSteps = fullTrajectory.length;
        const sceneStep = scenePts.length;

        const intervalId = window.setInterval(() => {
          stepIdx++;
          if (stepIdx < totalSteps) {
            ambMarker.setLatLng(fullTrajectory[stepIdx]);
            if (stepIdx === sceneStep) {
              currentStep = 2;
              dispatchPhase = `Ambulance #${idx + 1} (${asgn.ambulance.vehicle_number}) arrived on scene. Loading casualties [${asgn.passengers.map((p) => p.patient_id).join(', ')}]...`;
              if (phaseText) phaseText.textContent = dispatchPhase;
              if (resultsContainer) resultsContainer.innerHTML = renderDispatchResults();
            } else if (stepIdx === totalSteps - 1) {
              currentStep = 3;
              dispatchPhase = `All units delivered to designated trauma/district hospitals (${asgn.designated_hospital.name}). Emergency beds & specialists ready.`;
              if (phaseText) phaseText.textContent = dispatchPhase;
              if (resultsContainer) resultsContainer.innerHTML = renderDispatchResults();
            }
          } else {
            clearInterval(intervalId);
          }
        }, Math.max(45, 120 - Math.min(60, totalSteps)));

        multiIntervals.push(intervalId);
      });
    } catch (err) {
      alert(err.message || 'Multi-dispatch coordination error');
    } finally {
      isSimulatingDispatch = false;
      const dispatchBtn = container.querySelector('#btn-cc-dispatch');
      if (dispatchBtn) {
        dispatchBtn.disabled = false;
        dispatchBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Dispatch Multi-Ambulance Fleet (${patientCount} Patient${patientCount > 1 ? 's' : ''})`;
      }
    }
  };

  render();

  return {
    element: container,
    update(newData) {
      currentData = newData;
      const metrics = currentData?.metrics || {
        total_incidents: 0,
        active_emergencies: 0,
        available_ambulances: 0,
        total_ambulances: 0,
        referrals_in_transit: 0,
        facilities_monitored: 0,
      };

      const mEmerg = container.querySelector('#cc-metric-emergencies');
      if (mEmerg) mEmerg.textContent = metrics.active_emergencies;

      const mAmb = container.querySelector('#cc-metric-ambulances');
      if (mAmb) mAmb.textContent = `${metrics.available_ambulances} / ${metrics.total_ambulances}`;

      const mFac = container.querySelector('#cc-metric-facilities');
      if (mFac) mFac.textContent = metrics.facilities_monitored || 113;

      const mRef = container.querySelector('#cc-metric-referrals');
      if (mRef) mRef.textContent = `${metrics.referrals_in_transit} In Transit`;

      const tbody = container.querySelector('#cc-log-table-body');
      if (tbody) {
        tbody.innerHTML = renderLogTableRows();
        bindLogTableEvents();
      }

      refreshMapMarkers();
    },
    destroy() {
      multiIntervals.forEach((i) => clearInterval(i));
      multiIntervals = [];
      if (mapInstance) {
        try {
          mapInstance.remove();
        } catch (e) {}
        mapInstance = null;
        markersLayer = null;
        routeLayer = null;
      }
    },
  };
}
