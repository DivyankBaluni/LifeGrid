import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Activity,
  Ambulance as AmbulanceIcon,
  Building2,
  RefreshCw,
  Search,
  Radio,
  Share2,
  Navigation,
  Send,
  Sparkles,
  Users,
  ShieldAlert,
  MapPin,
  Crosshair,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Car,
  Info,
} from 'lucide-react';
import { AISuggestionBadge } from '../components/AISuggestionBadge';
import { ExplainabilityModal } from '../components/ExplainabilityModal';
import { OverrideModal } from '../components/OverrideModal';
import { Ambulance3DViewer } from '../components/Ambulance3DViewer';
import { executeMultiDispatch } from '../api/client';

interface ControlCenterProps {
  overviewData: any;
  onRefresh: () => void;
  userRole: string;
}

const REGIONS: { [key: string]: { name: string; center: [number, number]; zoom: number } } = {
  dehradun: { name: 'Uttarakhand (Dehradun & Rishikesh Hub)', center: [30.3165, 78.0322], zoom: 12 },
  all: { name: 'Pan-India Overview', center: [20.5937, 78.9629], zoom: 5 },
  maharashtra: { name: 'Maharashtra (Rural Demo Cluster)', center: [19.88, 75.38], zoom: 12 },
  mumbai: { name: 'Mumbai Metropolitan', center: [19.0760, 72.8777], zoom: 12 },
  delhi: { name: 'Delhi NCR Region', center: [28.6139, 77.2090], zoom: 12 },
  bengaluru: { name: 'Bengaluru Tech Corridor', center: [12.9716, 77.5946], zoom: 12 },
};

// Emergency type definitions matching the rich catalog
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

export const ControlCenter: React.FC<ControlCenterProps> = ({
  overviewData,
  onRefresh,
  userRole,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const multiMarkersRef = useRef<L.Marker[]>([]);
  const multiIntervalsRef = useRef<number[]>([]);

  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [selectedFacility, setSelectedFacility] = useState<any>(null);
  const [activeTrace, setActiveTrace] = useState<any>(null);
  const [overrideTriageId, setOverrideTriageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentRegion, setCurrentRegion] = useState<string>('dehradun');

  // Interactive Live Emergency Report Form State
  const [incidentPin, setIncidentPin] = useState<{ lat: number; lng: number }>({ lat: 30.3398, lng: 78.0644 });
  const [patientCount, setPatientCount] = useState<number>(4);
  const [unconsciousCount, setUnconsciousCount] = useState<number>(1);
  const [oldestAge, setOldestAge] = useState<string>('58');
  const [youngestAge, setYoungestAge] = useState<string>('24');
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['road']);
  const [incidentSymptoms, setIncidentSymptoms] = useState<string>(
    'Multiple casualty collision on Rajpur Road: 4 patients (STEMI cardiac shock, intracranial hemorrhage, femur fractures, and blunt chest trauma)'
  );

  // Grouped clinical condition indicators
  const [chkBleeding, setChkBleeding] = useState<boolean>(true);
  const [chkBreathing, setChkBreathing] = useState<boolean>(true);
  const [chkFracture, setChkFracture] = useState<boolean>(true);
  const [chkSpine, setChkSpine] = useState<boolean>(false);
  const [chkTrapped, setChkTrapped] = useState<boolean>(true);
  const [chkFire, setChkFire] = useState<boolean>(false);
  const [chkHazmat, setChkHazmat] = useState<boolean>(false);

  // Dispatch lifecycle and telemetry
  const [isSimulatingDispatch, setIsSimulatingDispatch] = useState<boolean>(false);
  const [activeMultiResult, setActiveMultiResult] = useState<any | null>(null);
  const [selectedAmbulanceFor3D, setSelectedAmbulanceFor3D] = useState<any | null>(null);
  const [dispatchPhase, setDispatchPhase] = useState<string>('');
  const [currentStep, setCurrentStep] = useState<number>(0); // 0: Idle, 1: Dispatched, 2: At Scene, 3: Delivered

  const metrics = overviewData?.metrics || {
    total_incidents: 0,
    active_emergencies: 0,
    available_ambulances: 0,
    total_ambulances: 0,
    referrals_in_transit: 0,
    facilities_monitored: 0,
  };

  const hospitals = overviewData?.hospitals || [];
  const incidents = overviewData?.incidents || [];
  const ambulances = overviewData?.ambulances || [];

  // Calculate dynamic severity estimate (0 - 100)
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

  const severityScore = calculateEstimatedSeverity();
  const severityLevel = severityScore >= 75 ? 'CRITICAL (P1)' : severityScore >= 50 ? 'HIGH (P2)' : 'MODERATE (P3)';
  const severityColor = severityScore >= 75 ? '#dc2626' : severityScore >= 50 ? '#ea580c' : '#16a34a';

  // Toggle incident type
  const handleToggleType = (typeId: string) => {
    setSelectedTypes((prev) => {
      const exists = prev.includes(typeId);
      const next = exists ? prev.filter((t) => t !== typeId) : [...prev, typeId];
      if (next.length === 0) return [typeId]; // keep at least one

      // Update symptom description if selecting a primary type
      const found = INCIDENT_TYPES.find((t) => t.id === typeId);
      if (!exists && found) {
        setIncidentSymptoms(`${found.defaultDesc} (${patientCount} casualty/ies reported)`);
      }
      return next;
    });
  };

  // Quick Preset Scenarios
  const handleApplyPreset = (preset: {
    title: string;
    complaint: string;
    count: number;
    unconscious: number;
    types: string[];
    lat: number;
    lng: number;
    bleeding?: boolean;
    breathing?: boolean;
    trapped?: boolean;
    fire?: boolean;
  }) => {
    setPatientCount(preset.count);
    setUnconsciousCount(preset.unconscious);
    setIncidentSymptoms(preset.complaint);
    setSelectedTypes(preset.types);
    setIncidentPin({ lat: preset.lat, lng: preset.lng });
    setChkBleeding(!!preset.bleeding);
    setChkBreathing(!!preset.breathing);
    setChkTrapped(!!preset.trapped);
    setChkFire(!!preset.fire);

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([preset.lat, preset.lng], 13, { duration: 1 });
    }
  };

  // GPS Device Capture
  const handleGetGPS = () => {
    if (!navigator.geolocation) {
      alert('Geolocation not supported by browser. Using default Dehradun location.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(4));
        const lng = Number(pos.coords.longitude.toFixed(4));
        setIncidentPin({ lat, lng });
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([lat, lng], 14, { duration: 1 });
        }
      },
      () => {
        alert('GPS permission denied or unavailable. Setting Dehradun clock tower center.');
        setIncidentPin({ lat: 30.3255, lng: 78.0436 });
      }
    );
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: REGIONS[currentRegion].center,
        zoom: REGIONS[currentRegion].zoom,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors | LIFEGRID',
        maxZoom: 18,
      }).addTo(map);

      const markersLayer = L.layerGroup().addTo(map);
      const routeLayer = L.layerGroup().addTo(map);

      markersLayerRef.current = markersLayer;
      routeLayerRef.current = routeLayer;
      mapInstanceRef.current = map;

      // Click anywhere to set incident pin
      map.on('click', (e) => {
        setIncidentPin({
          lat: Number(e.latlng.lat.toFixed(4)),
          lng: Number(e.latlng.lng.toFixed(4)),
        });
      });
    }

    return () => {
      multiIntervalsRef.current.forEach((i) => clearInterval(i));
    };
  }, []);

  // Handle region switch
  const handleRegionChange = (newRegKey: string) => {
    setCurrentRegion(newRegKey);
    const reg = REGIONS[newRegKey];
    if (mapInstanceRef.current && reg) {
      mapInstanceRef.current.flyTo(reg.center, reg.zoom, { duration: 1.2 });
      setIncidentPin({ lat: reg.center[0], lng: reg.center[1] });
    }
  };

  // Render Markers on Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    // 1. Facility Markers (Hospitals)
    hospitals.forEach((h: any) => {
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
            <span style="font-size: 11px; color: #64748b; font-weight: 600;">${h.tier.replace('_', ' ').toUpperCase()}</span><br/>
            <div style="margin-top: 6px; font-size: 12px; color: #1e293b;">
              General Beds: <strong>${h.beds_available}/${h.bed_capacity}</strong><br/>
              ICU Beds: <strong style="color: #b91c1c;">${h.available_icu || 2}/${h.icu_beds || 10}</strong><br/>
              Status: <strong>${h.accessibility_status}</strong>
            </div>
          </div>
        `);

      marker.on('click', () => {
        setSelectedFacility(h);
        setSelectedIncident(null);
      });

      markersLayer.addLayer(marker);
    });

    // 2. Incident Markers
    incidents.forEach((inc: any) => {
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
            <span style="font-size: 11px; color: #dc2626; font-weight: bold;">${inc.status.toUpperCase()}</span><br/>
            <p style="margin-top: 4px; font-size: 12px; color: #334155;">${inc.raw_symptoms.slice(0, 60)}...</p>
          </div>
        `);

      marker.on('click', () => {
        setSelectedIncident(inc);
        setSelectedFacility(null);
      });

      markersLayer.addLayer(marker);
    });

    // 3. Ambulances
    ambulances.forEach((amb: any) => {
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
            <span style="font-size: 11px;">Status: <b>${amb.status.toUpperCase()}</b></span><br/>
            <span style="font-size: 11px; color: #64748b;">Tags: ${amb.capability_tags.join(', ')}</span><br/>
            <span style="font-size: 11px;">Capacity: <b>${amb.capacity || 1} patient(s)</b></span>
          </div>
        `);

      marker.on('click', () => {
        setSelectedAmbulanceFor3D({
          id: amb.id,
          name: amb.vehicle_number,
          type: amb.capability_tags.includes('ALS') ? 'ALS' : 'BLS',
          model: 'Force Traveller Medical',
          license_plate: amb.vehicle_number,
          status: amb.status,
          equipment: amb.capability_tags,
        });
      });

      markersLayer.addLayer(marker);
    });

    // 4. Current Target Incident Pin
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

  }, [hospitals, incidents, ambulances, incidentPin]);

  // Trigger Road-Following Multi-Ambulance Dispatch with OSRM Geometry
  const handleTriggerDispatch = async () => {
    try {
      setIsSimulatingDispatch(true);
      setCurrentStep(1); // Dispatched
      setDispatchPhase(`Querying OSRM road geometry & allocating emergency units for ${patientCount} casualty(ies)...`);

      // Clear existing animated markers & timers
      multiMarkersRef.current.forEach((m) => mapInstanceRef.current?.removeLayer(m));
      multiMarkersRef.current = [];
      multiIntervalsRef.current.forEach((i) => clearInterval(i));
      multiIntervalsRef.current = [];

      const routeLayer = routeLayerRef.current;
      if (routeLayer) routeLayer.clearLayers();

      // Dispatch API call
      const multiResult = await executeMultiDispatch({
        incident_location: { latitude: incidentPin.lat, longitude: incidentPin.lng },
        patient_count: patientCount,
        chief_complaint: incidentSymptoms,
      });

      setActiveMultiResult(multiResult);

      const assignments = multiResult.assignments || [];
      const ROUTE_COLORS = ['#dc2626', '#0284c7', '#7e22ce', '#059669', '#ea580c', '#d97706'];

      setDispatchPhase(
        `Dispatched ${multiResult.ambulances_dispatched} unit(s) for ${multiResult.total_patients} patient(s). Following road geometry to incident scene...`
      );

      // Render actual road polylines & animate ambulance along authentic road turns
      assignments.forEach((asgn: any, idx: number) => {
        const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
        const scenePts: [number, number][] = asgn.route_to_scene || [];
        const hospPts: [number, number][] = asgn.route_to_hospital || [];

        if (routeLayer) {
          // Leg 1: Ambulance Station -> Scene (Dashed Road Polyline)
          const line1 = L.polyline(scenePts, {
            color,
            weight: 4.5,
            opacity: 0.9,
            dashArray: '8, 6',
          });
          // Leg 2: Scene -> Designated Hospital (Solid High-Contrast Road Polyline)
          const line2 = L.polyline(hospPts, {
            color,
            weight: 4.5,
            opacity: 0.95,
          });

          routeLayer.addLayer(line1);
          routeLayer.addLayer(line2);
        }

        // Animated Ambulance Marker
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
        const ambMarker = L.marker(startPt, { icon: ambIcon }).addTo(routeLayer!);
        multiMarkersRef.current.push(ambMarker);

        ambMarker.bindPopup(`
          <div style="font-family: sans-serif; min-width: 210px;">
            <strong style="color: ${color}; font-size: 13px;">${asgn.ambulance.vehicle_number}</strong><br/>
            <span style="font-size: 11px; color: #475569;">Driver: ${asgn.ambulance.driver_name} | Paramedic: ${asgn.ambulance.paramedic_name}</span><br/>
            <hr style="margin: 5px 0; border: none; border-top: 1px solid #e2e8f0;"/>
            <div style="font-size: 11px;">
              <strong>Assigned Patients (${asgn.passengers.length}):</strong><br/>
              ${asgn.passengers.map((p: any) => `• [${p.priority}] ${p.patient_id}: ${p.condition}`).join('<br/>')}
            </div>
            <div style="margin-top: 5px; font-size: 11.5px; color: #15803d; font-weight: 700;">
              ➔ Hospital: ${asgn.designated_hospital.name} (Road ETA: ${asgn.total_eta_min}m)
            </div>
          </div>
        `);

        // Combined waypoints: Station -> Scene then Scene -> Hospital
        const fullTrajectory = [...scenePts, ...hospPts];
        let stepIdx = 0;
        const totalSteps = fullTrajectory.length;
        const sceneStep = scenePts.length;

        // Animate along road steps smoothly
        const intervalId = window.setInterval(() => {
          stepIdx++;
          if (stepIdx < totalSteps) {
            ambMarker.setLatLng(fullTrajectory[stepIdx]);
            if (stepIdx === sceneStep) {
              setCurrentStep(2); // At Scene
              setDispatchPhase(
                `Ambulance #${idx + 1} (${asgn.ambulance.vehicle_number}) arrived on scene. Loading casualties [${asgn.passengers.map((p: any) => p.patient_id).join(', ')}]...`
              );
            } else if (stepIdx === totalSteps - 1) {
              setCurrentStep(3); // Delivered
              setDispatchPhase(
                `All units delivered to designated trauma/district hospitals (${asgn.designated_hospital.name}). Emergency beds & specialists ready.`
              );
            }
          } else {
            clearInterval(intervalId);
          }
        }, Math.max(45, 120 - Math.min(60, totalSteps))); // Dynamic interval based on route length

        multiIntervalsRef.current.push(intervalId);
      });
    } catch (err: any) {
      alert(err.message || 'Multi-dispatch coordination error');
    } finally {
      setIsSimulatingDispatch(false);
    }
  };

  const filteredIncidents = incidents.filter((i: any) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchText = `${i.id} ${i.raw_symptoms} ${i.location?.address || ''}`.toLowerCase();
      if (!matchText.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="cc-container">
      {/* Top Institutional Metrics Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
        }}
      >
        <div style={{ backgroundColor: '#ffffff', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b' }}>ACTIVE EMERGENCIES</span>
            <Activity size={18} color="#dc2626" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
            {metrics.active_emergencies}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#dc2626', fontWeight: 600 }}>
            Real-time live monitoring
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b' }}>AMBULANCES READY</span>
            <AmbulanceIcon size={18} color="#0284c7" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
            {metrics.available_ambulances} / {metrics.total_ambulances}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#0284c7', fontWeight: 600 }}>
            15 Uttarakhand Units Online
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b' }}>HOSPITALS ACTIVE</span>
            <Building2 size={18} color="#15803d" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
            {metrics.facilities_monitored || 113}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#15803d', fontWeight: 600 }}>
            GeoJSON Validated Facilities
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b' }}>REFERRALS CONTINUITY</span>
            <Share2 size={18} color="#7e22ce" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
            {metrics.referrals_in_transit} In Transit
          </div>
          <div style={{ fontSize: '0.7rem', color: '#7e22ce', fontWeight: 600 }}>
            3-Tier Context Synchronized
          </div>
        </div>
      </div>

      {/* Main 3-Panel High-Tech Command Center Grid */}
      <div className="cc-grid">
        {/* ============================================================
            PANEL 1 (LEFT): REPORT EMERGENCY FORM
            ============================================================ */}
        <aside className="cc-panel" style={{ maxHeight: '720px', overflowY: 'auto' }}>
          <div className="cc-panel-header">
            <h2>
              <AlertTriangle size={16} color="#dc2626" />
              Report Emergency
            </h2>
            <span style={{ fontSize: '0.68rem', backgroundColor: '#fee2e2', color: '#b91c1c', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
              LIVE DISPATCH
            </span>
          </div>

          {/* Quick Scenario Preset Bench */}
          <div style={{ padding: '10px 14px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={12} color="#7e22ce" />
              Quick Emergency Presets
            </div>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: '0.68rem', padding: '3px 6px' }}
                onClick={() =>
                  handleApplyPreset({
                    title: 'Rajpur Crash',
                    complaint: 'Highway collision on Rajpur Road: 4 casualties with critical cardiac shock, intracranial hemorrhage, femur fractures, and chest trauma',
                    count: 4,
                    unconscious: 2,
                    types: ['road', 'cardiac'],
                    lat: 30.3398,
                    lng: 78.0644,
                    bleeding: true,
                    breathing: true,
                    trapped: true,
                  })
                }
              >
                🚌 Rajpur Crash (4)
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: '0.68rem', padding: '3px 6px' }}
                onClick={() =>
                  handleApplyPreset({
                    title: 'Selaqui Fire',
                    complaint: 'Industrial chemical flash fire in Selaqui pharmaceutical factory: 8 casualties with severe 3rd-degree burns and acute smoke inhalation',
                    count: 8,
                    unconscious: 3,
                    types: ['burn', 'breathing'],
                    lat: 30.3685,
                    lng: 77.8540,
                    breathing: true,
                    trapped: false,
                    fire: true,
                  })
                }
              >
                🔥 Selaqui Fire (8)
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: '0.68rem', padding: '3px 6px' }}
                onClick={() =>
                  handleApplyPreset({
                    title: 'Mussoorie Landslide',
                    complaint: 'Tourist van caught in Mussoorie bypass landslide: 12 casualties with blunt polytrauma, limb amputations, and trapped victims',
                    count: 12,
                    unconscious: 4,
                    types: ['fall', 'road'],
                    lat: 30.4598,
                    lng: 78.0644,
                    bleeding: true,
                    trapped: true,
                  })
                }
              >
                ⛰️ Landslide (12)
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: '0.68rem', padding: '3px 6px' }}
                onClick={() =>
                  handleApplyPreset({
                    title: 'Ballupur STEMI',
                    complaint: 'Acute STEMI cardiac arrest at Ballupur Chowk with pulmonary edema and unconsciousness',
                    count: 1,
                    unconscious: 1,
                    types: ['cardiac'],
                    lat: 30.3350,
                    lng: 78.0120,
                    breathing: true,
                  })
                }
              >
                ❤️ Cardiac STEMI (1)
              </button>
            </div>
          </div>

          {/* Incident Location Coordinates */}
          <div className="cc-form-section">
            <label className="cc-section-label">
              <MapPin size={13} color="#0284c7" /> Incident Location
            </label>
            <div className="cc-coord-row">
              <div className="cc-input-group">
                <label>Latitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={incidentPin.lat}
                  onChange={(e) => setIncidentPin({ ...incidentPin, lat: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="cc-input-group">
                <label>Longitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={incidentPin.lng}
                  onChange={(e) => setIncidentPin({ ...incidentPin, lng: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ flex: 1, padding: '4px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                onClick={handleGetGPS}
              >
                <Crosshair size={12} color="#0284c7" /> Use Device GPS
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ flex: 1, padding: '4px 8px', fontSize: '0.72rem' }}
                onClick={() => {
                  setIncidentPin({ lat: 30.3255, lng: 78.0436 });
                  if (mapInstanceRef.current) mapInstanceRef.current.flyTo([30.3255, 78.0436], 13);
                }}
              >
                Dehradun Center
              </button>
            </div>
          </div>

          {/* Casualties / Patient Count & Demographics */}
          <div className="cc-form-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="cc-section-label">
                <Users size={13} color="#2563eb" /> Casualties / Patients
              </label>
              <span style={{ fontSize: '0.68rem', color: patientCount > 2 ? '#dc2626' : '#64748b', fontWeight: 700 }}>
                {patientCount > 2 ? '⚠️ Multi-Ambulance Required' : 'Single Ambulance'}
              </span>
            </div>

            {/* Expanded Quick Count Buttons (1, 2, 3, 4, 5, 8, 12, 16, 20+) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
              {[1, 2, 3, 4, 5, 6, 8, 10, 15, 20].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setPatientCount(num)}
                  style={{
                    padding: '4px 0',
                    fontSize: '0.72rem',
                    fontWeight: patientCount === num ? 800 : 500,
                    backgroundColor: patientCount === num ? '#1e40af' : '#f8fafc',
                    color: patientCount === num ? '#ffffff' : '#334155',
                    border: `1px solid ${patientCount === num ? '#1e40af' : '#cbd5e1'}`,
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  {num}
                </button>
              ))}
            </div>

            {/* Arbitrary Custom Casualty Count Input */}
            <div className="cc-coord-row" style={{ marginTop: '4px' }}>
              <div className="cc-input-group">
                <label>Exact Casualty Count (1 - 50+)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={patientCount}
                  onChange={(e) => setPatientCount(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>
              <div className="cc-input-group">
                <label>Unconscious Victims</label>
                <input
                  type="number"
                  min="0"
                  max={patientCount}
                  value={unconsciousCount}
                  onChange={(e) => setUnconsciousCount(Math.max(0, parseInt(e.target.value) || 0))}
                />
              </div>
            </div>

            <div className="cc-coord-row">
              <div className="cc-input-group">
                <label>Oldest Age</label>
                <input
                  type="number"
                  value={oldestAge}
                  placeholder="e.g. 68"
                  onChange={(e) => setOldestAge(e.target.value)}
                />
              </div>
              <div className="cc-input-group">
                <label>Youngest Age</label>
                <input
                  type="number"
                  value={youngestAge}
                  placeholder="e.g. 5"
                  onChange={(e) => setYoungestAge(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Incident Type Grid (Multi-Select) */}
          <div className="cc-form-section">
            <label className="cc-section-label">
              <Car size={13} color="#ea580c" /> Incident Category (Multi-Select)
            </label>
            <div className="cc-type-grid">
              {INCIDENT_TYPES.map((t) => {
                const isActive = selectedTypes.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`cc-type-btn ${isActive ? 'active' : ''}`}
                    onClick={() => handleToggleType(t.id)}
                  >
                    <span style={{ fontSize: '15px' }}>{t.icon}</span>
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Emergency Indicators & Clinical Severity Checklist */}
          <div className="cc-form-section">
            <label className="cc-section-label">
              <ShieldAlert size={13} color="#dc2626" /> Emergency Indicators
            </label>

            <div className="cc-flag-group-title">Patient Condition</div>
            <label className="cc-checkbox-row">
              <input type="checkbox" checked={chkBleeding} onChange={(e) => setChkBleeding(e.target.checked)} />
              <span>Severe Active Hemorrhage / Bleeding</span>
            </label>
            <label className="cc-checkbox-row">
              <input type="checkbox" checked={chkBreathing} onChange={(e) => setChkBreathing(e.target.checked)} />
              <span>Acute Airway / Breathing Difficulty</span>
            </label>
            <label className="cc-checkbox-row">
              <input type="checkbox" checked={chkFracture} onChange={(e) => setChkFracture(e.target.checked)} />
              <span>Suspected Compound Fracture</span>
            </label>
            <label className="cc-checkbox-row">
              <input type="checkbox" checked={chkSpine} onChange={(e) => setChkSpine(e.target.checked)} />
              <span>Spinal / Cervical Immobilization Needed</span>
            </label>

            <div className="cc-flag-group-title">Scene Hazards</div>
            <label className="cc-checkbox-row">
              <input type="checkbox" checked={chkTrapped} onChange={(e) => setChkTrapped(e.target.checked)} />
              <span>Patient Trapped / Vehicle Extrication Required</span>
            </label>
            <label className="cc-checkbox-row">
              <input type="checkbox" checked={chkFire} onChange={(e) => setChkFire(e.target.checked)} />
              <span>Active Fire / Toxic Smoke Hazard</span>
            </label>
            <label className="cc-checkbox-row">
              <input type="checkbox" checked={chkHazmat} onChange={(e) => setChkHazmat(e.target.checked)} />
              <span>Hazardous Material / Chemical Spill</span>
            </label>
          </div>

          {/* Description / Chief Complaint */}
          <div className="cc-form-section">
            <label className="cc-section-label">
              <Info size={13} color="#475569" /> Chief Complaint / Scene Description
            </label>
            <textarea
              rows={2}
              value={incidentSymptoms}
              onChange={(e) => setIncidentSymptoms(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.78rem',
                fontFamily: 'inherit',
                resize: 'vertical',
                outline: 'none',
              }}
            />
          </div>

          {/* Severity Score Preview */}
          <div className="cc-severity-bar">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>ESTIMATED PRIORITY:</span>
              <strong style={{ fontSize: '0.8rem', color: severityColor }}>{severityLevel}</strong>
            </div>
            <div style={{ height: '7px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${severityScore}%`,
                  backgroundColor: severityColor,
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#64748b' }}>
              <span>Acuity Score: {severityScore}/100</span>
              <span>Matched Fleet: {patientCount > 4 ? 'Multi-ALS/BLS Fleet' : 'ALS Dedicated'}</span>
            </div>
          </div>

          {/* Dispatch Action Button */}
          <div style={{ padding: '12px 16px' }}>
            <button
              type="button"
              disabled={isSimulatingDispatch}
              onClick={handleTriggerDispatch}
              style={{
                width: '100%',
                backgroundColor: '#dc2626',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '0.85rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(220, 38, 38, 0.35)',
              }}
            >
              <Send size={15} />
              {isSimulatingDispatch
                ? 'Coordinating Fleet...'
                : `Dispatch Multi-Ambulance Fleet (${patientCount} Patient${patientCount > 1 ? 's' : ''})`}
            </button>
          </div>
        </aside>

        {/* ============================================================
            PANEL 2 (CENTER): INTERACTIVE ROAD MAP & ETA COUNTER
            ============================================================ */}
        <section className="cc-panel" style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
          {/* Map Header with Region Switcher */}
          <div className="cc-panel-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Radio size={16} color="#15803d" />
              <h3>Uttarakhand Dispatch Radar & Live Fleet</h3>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <select
                value={currentRegion}
                onChange={(e) => handleRegionChange(e.target.value)}
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: '#0f172a',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                }}
              >
                {Object.entries(REGIONS).map(([key, reg]) => (
                  <option key={key} value={key}>
                    📍 {reg.name}
                  </option>
                ))}
              </select>

              <button
                onClick={onRefresh}
                className="btn-secondary"
                style={{ padding: '3px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <RefreshCw size={11} /> Refresh
              </button>
            </div>
          </div>

          {/* Floating Dispatch Progress / ETA Counter Banner */}
          {dispatchPhase && (
            <div
              style={{
                backgroundColor: '#eff6ff',
                borderBottom: '1px solid #bfdbfe',
                padding: '8px 14px',
                fontSize: '0.78rem',
                color: '#1e40af',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                zIndex: 10,
              }}
            >
              <Navigation size={14} className="animate-spin" />
              <span>{dispatchPhase}</span>
            </div>
          )}

          {/* Leaflet Map Div */}
          <div ref={mapContainerRef} style={{ flex: 1, minHeight: '520px', width: '100%' }} />

          {/* Map Status Bar & Legend */}
          <div
            style={{
              padding: '6px 14px',
              backgroundColor: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              fontSize: '0.72rem',
              color: '#64748b',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0284c7', display: 'inline-block' }} />
                Ambulance (ALS/BLS)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#1e40af', display: 'inline-block' }} />
                District / Super-Specialty
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#15803d', display: 'inline-block' }} />
                PHC / Rural Center
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#dc2626', display: 'inline-block' }} />
                Incident Target
              </span>
            </div>
            <div style={{ fontWeight: 600, color: '#0f172a' }}>
              📍 Pin: {incidentPin.lat.toFixed(4)}, {incidentPin.lng.toFixed(4)}
            </div>
          </div>
        </section>

        {/* ============================================================
            PANEL 3 (RIGHT): LIVE DISPATCH RESULTS & AI DIAGNOSTIC BENCH
            ============================================================ */}
        <aside className="cc-panel" style={{ maxHeight: '720px', overflowY: 'auto' }}>
          <div className="cc-panel-header">
            <h2>
              <Sparkles size={16} color="#7e22ce" />
              Dispatch Result
            </h2>
            <span style={{ fontSize: '0.68rem', backgroundColor: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
              AI MATCH
            </span>
          </div>

          {!activeMultiResult ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <Radio size={36} color="#94a3b8" />
              <p style={{ fontWeight: 600, fontSize: '0.88rem', color: '#334155' }}>Awaiting Emergency Report...</p>
              <p style={{ fontSize: '0.74rem' }}>
                Click anywhere on the map or choose a preset on the left, then click <strong>Dispatch Multi-Ambulance Fleet</strong>.
              </p>
            </div>
          ) : (
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Summary Severity Banner */}
              <div
                style={{
                  backgroundColor: '#fee2e2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase' }}>
                    Triaged Severity & Load
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#b91c1c' }}>
                    {activeMultiResult.total_patients} Casualty(ies) · {activeMultiResult.ambulances_dispatched} Unit(s)
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.68rem', backgroundColor: '#b91c1c', color: '#ffffff', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                    CODE RED
                  </span>
                </div>
              </div>

              {/* Dispatched Units Breakdown */}
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                Dispatched Fleet Allocation
              </div>

              {activeMultiResult.assignments.map((asgn: any, idx: number) => {
                const ROUTE_COLORS = ['#dc2626', '#0284c7', '#7e22ce', '#059669', '#ea580c', '#d97706'];
                const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];

                return (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: '#ffffff',
                      border: `1px solid ${color}40`,
                      borderLeft: `4px solid ${color}`,
                      borderRadius: '8px',
                      padding: '10px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                      <div>
                        <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>
                          🚑 {asgn.ambulance.vehicle_number}
                        </strong>
                        <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                          Driver: {asgn.ambulance.driver_name} · Paramedic: {asgn.ambulance.paramedic_name}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.92rem', fontWeight: 800, color, fontFamily: 'monospace' }}>
                          {asgn.total_eta_min}m
                        </div>
                        <div style={{ fontSize: '0.64rem', color: '#64748b' }}>TOTAL ETA</div>
                      </div>
                    </div>

                    {/* Passenger Manifest */}
                    <div style={{ backgroundColor: '#f8fafc', padding: '6px 8px', borderRadius: '4px', margin: '6px 0', fontSize: '0.7rem' }}>
                      <strong style={{ color: '#0f172a' }}>Passengers ({asgn.passengers.length}):</strong>
                      {asgn.passengers.map((p: any) => (
                        <div key={p.patient_id} style={{ marginTop: '2px', color: '#1e293b' }}>
                          • <strong style={{ color: p.priority === 'P1' ? '#dc2626' : '#0284c7' }}>[{p.priority}] {p.patient_id}:</strong> {p.condition}
                        </div>
                      ))}
                    </div>

                    {/* Designated Hospital */}
                    <div style={{ fontSize: '0.72rem', color: '#0f172a' }}>
                      🏥 Designated: <strong style={{ color: '#15803d' }}>{asgn.designated_hospital.name}</strong>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
                      {asgn.hospital_match_reason}
                    </div>
                  </div>
                );
              })}

              {/* Progress Timeline */}
              <div style={{ backgroundColor: '#f8fafc', borderRadius: '8px', padding: '10px 12px', border: '1px solid #e2e8f0', marginTop: '4px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Live Dispatch Milestone Timeline
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.72rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#15803d', fontWeight: 600 }}>
                    <CheckCircle2 size={14} />
                    <span>1. Emergency Reported & Triage Completed</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: currentStep >= 1 ? '#0284c7' : '#94a3b8', fontWeight: currentStep >= 1 ? 700 : 400 }}>
                    {currentStep >= 1 ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                    <span>2. Units Dispatched along OSRM Road Route</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: currentStep >= 2 ? '#0284c7' : '#94a3b8', fontWeight: currentStep >= 2 ? 700 : 400 }}>
                    {currentStep >= 2 ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                    <span>3. Converged on Scene & Loaded Patients</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: currentStep >= 3 ? '#15803d' : '#94a3b8', fontWeight: currentStep >= 3 ? 700 : 400 }}>
                    {currentStep >= 3 ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                    <span>4. Delivered to Designated Trauma Centers</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Selected Facility Details Card (when map hospital is clicked) */}
          {selectedFacility && (
            <div
              style={{
                margin: '10px 14px',
                padding: '12px',
                backgroundColor: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <strong style={{ fontSize: '0.84rem', color: '#0f172a' }}>🏥 {selectedFacility.name}</strong>
                <button
                  type="button"
                  onClick={() => setSelectedFacility(null)}
                  style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '11px', padding: '0 4px' }}
                >
                  ✕
                </button>
              </div>
              <div style={{ color: '#475569', marginBottom: '4px' }}>
                Tier: <strong>{selectedFacility.tier?.replace('_', ' ').toUpperCase()}</strong> · Beds: <strong>{selectedFacility.beds_available}/{selectedFacility.bed_capacity}</strong>
              </div>
              <div style={{ color: '#0369a1', marginBottom: '2px' }}>
                ICU Available: <strong>{selectedFacility.available_icu || 2}/{selectedFacility.icu_beds || 10}</strong>
              </div>
              <div style={{ color: '#64748b', fontSize: '0.7rem' }}>
                Capabilities: {selectedFacility.capability_tags?.join(', ') || 'General Medicine'}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* ============================================================
          BOTTOM SECTION: REAL-TIME INCIDENT LOG TABLE
          ============================================================ */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={16} color="#b91c1c" />
            <h3 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', margin: 0, textTransform: 'uppercase' }}>
              Real-Time Incident Log & Pan-India Dispatch Feed
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '7px' }} />
              <input
                type="text"
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: '4px 10px 4px 28px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.75rem',
                  outline: 'none',
                }}
              />
            </div>
            <button onClick={onRefresh} className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.72rem' }}>
              <RefreshCw size={11} /> Refresh Log
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="cc-log-table">
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
            <tbody>
              {filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                    No recorded emergency incidents matching criteria. Report an emergency above or trigger a preset scenario.
                  </td>
                </tr>
              ) : (
                filteredIncidents.map((inc: any) => {
                  const isSelected = selectedIncident?.id === inc.id;
                  return (
                    <tr
                      key={inc.id}
                      onClick={() => setSelectedIncident(inc)}
                      style={{
                        backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
                        #{inc.id.slice(0, 6)}
                      </td>
                      <td style={{ color: '#64748b', fontSize: '0.72rem' }}>
                        {new Date(inc.created_at || Date.now()).toLocaleTimeString()}
                      </td>
                      <td>
                        📍 {inc.location?.address || `${inc.location?.latitude?.toFixed(4)}, ${inc.location?.longitude?.toFixed(4)}`}
                      </td>
                      <td style={{ maxWidth: '320px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
                        {inc.raw_symptoms}
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: inc.status === 'dispatched' ? '#e0f2fe' : '#fee2e2',
                            color: inc.status === 'dispatched' ? '#0369a1' : '#b91c1c',
                          }}
                        >
                          {inc.status.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 800, color: '#dc2626' }}>P1 CRITICAL</span>
                      </td>
                      <td>
                        <AISuggestionBadge
                          label="Explain AI"
                          onViewReasoning={async () => {
                            try {
                              const res = await fetch(`http://localhost:3001/api/triage/${inc.triage_result_id}`);
                              const trace = await res.json();
                              setActiveTrace(trace);
                            } catch (err) {
                              console.error('Failed to load trace', err);
                            }
                          }}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Explainability Trace Modal */}
      {activeTrace && (
        <ExplainabilityModal
          trace={activeTrace}
          onClose={() => setActiveTrace(null)}
          onOpenOverride={() => setOverrideTriageId(activeTrace.triage_id)}
          canOverride={userRole !== 'citizen'}
        />
      )}

      {/* Override Modal */}
      {overrideTriageId && (
        <OverrideModal
          triageId={overrideTriageId}
          currentPriority="P1"
          userRole={userRole}
          onClose={() => setOverrideTriageId(null)}
          onSuccess={() => onRefresh()}
        />
      )}

      {/* 3D Ambulance Visualizer Modal */}
      {selectedAmbulanceFor3D && (
        <Ambulance3DViewer
          ambulance={selectedAmbulanceFor3D}
          onClose={() => setSelectedAmbulanceFor3D(null)}
        />
      )}
    </div>
  );
};
