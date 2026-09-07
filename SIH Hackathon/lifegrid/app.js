/* ================================================================
   LIFEGRID — Main Application Logic
   SIH26133 | Emergency Healthcare Coordination Platform
   ================================================================ */

'use strict';

// ── Constants ────────────────────────────────────────────────────
const MAHARASHTRA_DISTRICTS = [
  'Ahmednagar','Akola','Amravati','Aurangabad','Beed','Bhandara','Buldhana',
  'Chandrapur','Dhule','Gadchiroli','Gondia','Hingoli','Jalgaon','Jalna',
  'Kolhapur','Latur','Mumbai','Mumbai Suburban','Nagpur','Nanded','Nandurbar',
  'Nashik','Osmanabad','Palghar','Parbhani','Pune','Raigad','Ratnagiri',
  'Sangli','Satara','Sindhudurg','Solapur','Thane','Wardha','Washim','Yavatmal'
];

const SPECIALTIES_LIST = [
  'Cardiologist','Neurologist','Orthopedic Surgeon','Pediatrician','Oncologist',
  'Nephrologist','Gynecologist','General Surgeon','Emergency Physician',
  'Pulmonologist','Psychiatrist','Ophthalmologist','ENT Specialist',
  'Gastroenterologist','Dermatologist','Endocrinologist','Urologist',
  'Plastic Surgeon','Vascular Surgeon','Radiologist','Pathologist','Anesthesiologist'
];

const FACILITIES_LIST = [
  'ICU','Blood Bank','Dialysis Unit','Emergency Room','Ambulance',
  'Pharmacy','Laboratory','X-Ray','CT Scan','MRI','Operation Theatre',
  'Neonatal ICU','Oxygen Supply','Ventilator','Cardiac Monitoring',
  'Physiotherapy','Chemotherapy','Dialysis'
];

const AMBULANCE_EQUIPMENT_LIST = [
  'Cardiac Monitor / Defibrillator','Ventilator','IV Infusion Pump',
  'Pulse Oximeter','ECG Machine (12-lead)','Oxygen Cylinder (Large)',
  'Suction Unit','Drug Box (ALS Medications)','Intubation Kit',
  'Splints & Cervical Collar','Stretcher','Blood Pressure Monitor',
  'Glucometer','First Aid Kit','Bag-Valve Mask','Spine Board',
  'Emergency Blankets','Neonatal Incubator','Point-of-Care Lab',
  'Syringe Pump','Wound Care Kit','Snake Bite Kit'
];

// ── Symptom → Condition Mapping (NLP Keywords) ──────────────────
const SYMPTOM_MAP = {
  'cardiac': {
    keywords: ['chest pain','seene mein dard','chati mein dard','heart attack','cardiac','dil','seena','heart','dhadkhan','bp high','blood pressure','palpitation','angina'],
    condition: 'Cardiac Emergency', specialist: 'Cardiologist', severity_boost: 2,
    needs: ['Cardiologist','ECG','Emergency Bed','Cardiac Monitoring']
  },
  'neuro': {
    keywords: ['stroke','brain','paralysis','laqwa','unconscious','behosh','seizure','epilepsy','convulsion','fits','sir dard','headache severe','loss of consciousness','coma'],
    condition: 'Neurological Emergency', specialist: 'Neurologist', severity_boost: 2,
    needs: ['Neurologist','CT Scan','ICU','Emergency Bed']
  },
  'trauma': {
    keywords: ['accident','crash','gira','fall','fracture','haddi','toota','injured','ghav','wound','bleeding','blood','lahu','khoon','crush','cut'],
    condition: 'Trauma / Injury', specialist: 'Orthopedic Surgeon', severity_boost: 1,
    needs: ['Orthopedic Surgeon','Operation Theatre','Blood Bank','Emergency Bed']
  },
  'breathing': {
    keywords: ['saans','breathe','breathing difficulty','suffocation','asthma','pneumonia','oxygen','dyspnea','respiratory','chest tight','cough','khasi','lungs'],
    condition: 'Respiratory Distress', specialist: 'Pulmonologist', severity_boost: 1,
    needs: ['Pulmonologist','Oxygen Supply','Ventilator','Emergency Bed']
  },
  'burn': {
    keywords: ['burn','jalana','jal gaya','fire','aag','scald','chemical burn'],
    condition: 'Burn Injury', specialist: 'Plastic Surgeon', severity_boost: 1,
    needs: ['Plastic Surgeon','Operation Theatre','ICU','Blood Bank']
  },
  'obstetric': {
    keywords: ['delivery','prasav','prasuti','pregnancy','pregnant','garbh','baby','janam','labor','labour','maternity','newborn','neonatal','premature'],
    condition: 'Obstetric Emergency', specialist: 'Gynecologist', severity_boost: 1,
    needs: ['Gynecologist','Neonatal ICU','Operation Theatre','Blood Bank']
  },
  'poison': {
    keywords: ['poison','zeher','overdose','chemical','snake bite','saanp','spider','jellyfish','toxic','pesticide','keetnaashak'],
    condition: 'Poisoning / Toxicology', specialist: 'Emergency Physician', severity_boost: 1,
    needs: ['Emergency Physician','ICU','Blood Bank','Ventilator']
  },
  'diabetic': {
    keywords: ['diabetes','sugar','glucose','insulin','hypoglycemia','hyperglycemia','diabetic','madhumeh'],
    condition: 'Diabetic Emergency', specialist: 'Endocrinologist', severity_boost: 0,
    needs: ['Endocrinologist','Emergency Bed','Laboratory']
  },
  'kidney': {
    keywords: ['kidney','gurda','urine','dialysis','renal','nephro'],
    condition: 'Renal Emergency', specialist: 'Nephrologist', severity_boost: 1,
    needs: ['Nephrologist','Dialysis Unit','ICU','Emergency Bed']
  },
  'eye': {
    keywords: ['eye','aankh','vision loss','blind','chemical eye'],
    condition: 'Ophthalmologic Emergency', specialist: 'Ophthalmologist', severity_boost: 0,
    needs: ['Ophthalmologist','Emergency Room']
  },
  'mental': {
    keywords: ['mental','suicide','khudkushi','depression','psychiatric','psychology','manasik','paagal','hallucination'],
    condition: 'Psychiatric Emergency', specialist: 'Psychiatrist', severity_boost: 0,
    needs: ['Psychiatrist','Emergency Room']
  },
  'fever': {
    keywords: ['fever','bukhar','temperature','malaria','dengue','typhoid','infection','sepsis','chills','thakaan'],
    condition: 'Infectious / Fever', specialist: 'General Surgeon', severity_boost: 0,
    needs: ['Emergency Physician','Laboratory','Emergency Bed']
  }
};

// ── Emergency Type → Required Equipment Map ─────────────────────
const EMERGENCY_TYPE_MAP = {
  burn: {
    label: '🔥 Burn Injured',
    color: '#ff6b35',
    description: 'Burn injury with severe skin damage',
    sampleText: 'Patient has severe burn injuries on arms and chest, needs immediate burn care',
    requiredEquipment: ['Wound Care Kit', 'IV Infusion Pump', 'Oxygen Cylinder (Large)', 'Drug Box (ALS Medications)'],
    preferredTypes: ['ALS', 'MICU'],
    symptomKey: 'burn'
  },
  cardiac: {
    label: '❤️ Cardiac',
    color: '#e63946',
    description: 'Heart attack, chest pain, cardiac arrest',
    sampleText: 'Patient has severe chest pain, palpitations, suspected heart attack, needs immediate cardiac care',
    requiredEquipment: ['Cardiac Monitor / Defibrillator', 'ECG Machine (12-lead)', 'IV Infusion Pump', 'Oxygen Cylinder (Large)'],
    preferredTypes: ['ALS', 'MICU'],
    symptomKey: 'cardiac'
  },
  neuro: {
    label: '🧠 Neurological',
    color: '#9c27b0',
    description: 'Stroke, seizure, loss of consciousness',
    sampleText: 'Patient unconscious, suspected stroke, paralysis on left side, needs urgent neurological care',
    requiredEquipment: ['Ventilator', 'IV Infusion Pump', 'Oxygen Cylinder (Large)', 'Drug Box (ALS Medications)'],
    preferredTypes: ['MICU', 'ALS'],
    symptomKey: 'neuro'
  },
  trauma: {
    label: '🤕 Trauma',
    color: '#ffbe0b',
    description: 'Accident, fracture, bleeding injury',
    sampleText: 'Road accident victim with multiple fractures and bleeding, needs trauma care',
    requiredEquipment: ['Spine Board', 'Splints & Cervical Collar', 'Blood Pressure Monitor', 'Wound Care Kit'],
    preferredTypes: ['ALS', 'BLS'],
    symptomKey: 'trauma'
  },
  obstetric: {
    label: '🤰 Obstetric',
    color: '#ff9800',
    description: 'Childbirth, pregnancy emergency, neonatal',
    sampleText: 'Pregnant woman in labor, premature delivery, needs maternity emergency care',
    requiredEquipment: ['Neonatal Incubator', 'Oxygen Hood', 'Suction Unit'],
    preferredTypes: ['NEO', 'ALS'],
    symptomKey: 'obstetric'
  },
  others: {
    label: '⚕️ Others',
    color: '#00d4ff',
    description: 'Other medical emergency',
    sampleText: '',
    requiredEquipment: [],
    preferredTypes: ['ALS', 'BLS'],
    symptomKey: null
  }
};

// ── App State ────────────────────────────────────────────────────
let state = {
  currentView: 'emergency',
  patientCount: 1,
  selectedLang: 'auto',
  userLat: 18.9220,
  userLng: 72.8347,
  triageResult: null,
  currentHospital: null,
  currentAmbulanceId: null,
  mapHospitals: [],
  mapFilter: { district: '', type: '' },
  voiceActive: false,
  dashHospital: null,
  dashAmbulance: null,
  bedStates: {},
  incomingAlerts: [],
  offlineMode: false,
  emergencyType: null,   // currently selected emergency type key
};


// ── Hospital Data (loaded async) ─────────────────────────────────
let HOSPITAL_DATA = [];
let dataLoaded = false;

// ── Initialize ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initSpecCheckboxes();
  initFacilityCheckboxes();
  initAmbulanceEquipChecklist();
  checkOffline();
  window.addEventListener('online',  () => { state.offlineMode = false; updateOfflineBanner(); });
  window.addEventListener('offline', () => { state.offlineMode = true;  updateOfflineBanner(); });

  // Load hospital data asynchronously
  loadHospitalData();
});

function setLoadUI(pct, msg) {
  const bar    = document.getElementById('loadBar');
  const status = document.getElementById('loadStatus');
  if (bar)    bar.style.width = pct + '%';
  if (status) status.textContent = msg;
}

async function loadHospitalData() {
  setLoadUI(10, 'Fetching hospital database...');
  try {
    const resp = await fetch('data/hospitals.json');
    if (resp.ok) {
      setLoadUI(40, 'Parsing hospital database...');
      const text = await resp.text();
      setLoadUI(65, 'Indexing records...');
      HOSPITAL_DATA = JSON.parse(text);
    } else {
      console.warn('hospitals.json returned status:', resp.status);
    }
  } catch(err) {
    console.warn('hospitals.json fetch failed (using available data):', err);
  }

  setLoadUI(75, 'Loading Uttarakhand GeoJSON data...');
  try {
    await mergeGeoJSONHospitals();
  } catch(gErr) {
    console.warn('GeoJSON merge error (non-fatal):', gErr);
  }

  setLoadUI(90, 'Initializing UI...');
  dataLoaded = true;

  try {
    onDataReady();
  } catch(uiErr) {
    console.error('Error during onDataReady:', uiErr);
  } finally {
    // ALWAYS dismiss the loading overlay
    setTimeout(() => {
      const overlay = document.getElementById('appLoadingOverlay');
      if (overlay) {
        overlay.style.transition = 'opacity .4s ease';
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 400);
      }
    }, 200);
  }
}

function updateStats() {
  const avail = AMBULANCE_DATA.filter(a => a.status === 'available').length;
  const allHospitals = [...HOSPITAL_DATA, ...getRegisteredHospitals()];
  const hEl = document.getElementById('statHospVal') || document.getElementById('stat-hospitals');
  if (hEl) hEl.textContent = allHospitals.length.toLocaleString();
  const aEl = document.getElementById('statAmbVal') || document.getElementById('stat-ambulances');
  if (aEl) aEl.textContent = avail + (document.getElementById('stat-ambulances') ? '/' + AMBULANCE_DATA.length : '');
  const icuCount = allHospitals.filter(h => h.has_icu).length;
  const icuEl = document.getElementById('stat-icu');
  if (icuEl) icuEl.textContent = icuCount;
  const states = new Set(allHospitals.map(h => h.state).filter(Boolean));
  const statesEl = document.getElementById('stat-states');
  if (statesEl) statesEl.textContent = states.size;
}

// ── Merge Uttarakhand GeoJSON Hospitals at Runtime ───────────────
async function mergeGeoJSONHospitals() {
  // Try multiple relative paths for the GeoJSON
  const GEOJSON_PATHS = [
    '../export.geojson',        // when served from lifegrid/ subdir
    'export.geojson',           // when served from root
    './export.geojson',
  ];
  let geojson = null;
  for (const path of GEOJSON_PATHS) {
    try {
      const resp = await fetch(path);
      if (resp.ok) {
        geojson = await resp.json();
        console.log('LIFEGRID: GeoJSON loaded from', path);
        break;
      }
    } catch(_) { /* try next */ }
  }
  if (!geojson) {
    console.warn('GeoJSON not accessible via any path — skipping Uttarakhand merge');
    return;
  }
  const features = geojson.features || [];
  let merged = 0;
  const existingCoords = new Set(
    HOSPITAL_DATA.map(h => `${h.lat.toFixed(4)},${h.lng.toFixed(4)}`)
  );
  features.forEach((feat, idx) => {
    const props = feat.properties || {};
    const coords = feat.geometry && feat.geometry.coordinates;
    if (!coords || feat.geometry.type !== 'Point') return;
    const lng = coords[0], lat = coords[1];
    if (!lat || !lng) return;
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (existingCoords.has(key)) return; // deduplicate
    existingCoords.add(key);
    const name = props.name || props['name:en'] || '';
    if (!name) return; // skip unnamed
    const district = props['addr:district'] || props['addr:city'] || 'Dehradun';
    const stateVal = props['addr:state'] || 'Uttarakhand';
    const pincode = props['addr:postcode'] || '';
    const hasEmergency = props['emergency'] === 'yes' || props['emergency'] === 'true';
    const specialty = props['healthcare:speciality'] || '';
    const specialties = [];
    if (specialty.includes('maternity') || specialty.includes('gynae')) specialties.push('Gynecologist');
    if (specialty.includes('cardio')) specialties.push('Cardiologist');
    if (specialty.includes('ortho')) specialties.push('Orthopedic Surgeon');
    if (specialty.includes('neuro')) specialties.push('Neurologist');
    if (specialty.includes('eye') || specialty.includes('ophthal')) specialties.push('Ophthalmologist');
    const totalBeds = Math.floor(Math.random() * 80 + 20);
    const availBeds = Math.floor(totalBeds * (0.2 + Math.random() * 0.4));
    const hasICU = hasEmergency || Math.random() > 0.6;
    const newHospital = {
      id: `UK-GEO-${idx}`,
      name,
      address: props['addr:full'] || props['addr:street'] || '',
      district,
      subdistrict: props['addr:subdistrict'] || '',
      pincode,
      state: stateVal,
      lat, lng,
      category: props['description'] ? 'Public / Government' : 'Private',
      care_type: 'Hospital',
      phone: props['phone'] || props['contact:phone'] || '',
      emergency_num: hasEmergency ? (props['contact:phone'] || '') : '',
      specialties,
      has_icu: hasICU,
      has_blood_bank: Math.random() > 0.75,
      has_ambulance: hasEmergency || Math.random() > 0.65,
      has_emergency: hasEmergency,
      total_beds: totalBeds,
      available_beds: availBeds,
      icu_beds: hasICU ? Math.floor(Math.random() * 8 + 2) : 0,
      available_icu: hasICU ? Math.floor(Math.random() * 4 + 1) : 0,
      doctors: Math.floor(Math.random() * 15 + 3),
      facilities_raw: [hasICU?'ICU':'', hasEmergency?'Emergency Room':'', 'Pharmacy', 'Laboratory'].filter(Boolean).join(', '),
      accreditation: '',
      password: `hosp${idx}uk`,
    };
    HOSPITAL_DATA.push(newHospital);
    merged++;
  });
  console.log(`LIFEGRID: Merged ${merged} Uttarakhand hospitals from GeoJSON`);
}

function onDataReady() {
  setLoadUI(100, 'Ready!');
  initDistrictDropdowns();
  updateStats();
  loadRegisteredItems();
  if (typeof initCommandCenter === 'function') { initCommandCenter(); }

  // Hide overlay
  setTimeout(() => {
    const overlay = document.getElementById('appLoadingOverlay');
    if (overlay) {
      overlay.style.transition = 'opacity .5s ease';
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 500);
    }
  }, 300);
}



// updateStats defined above with safe null checks
// ── View Navigation ──────────────────────────────────────────────
function showView(id) {
  if (id === 'map') id = 'emergency';
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const view = document.getElementById('view-' + id);
  if (view) view.classList.remove('hidden');
  const navIdMap = {
    'emergency': 'nav-emergency',
    'map': 'nav-emergency',
    'h-dashboard': 'nav-hdash',
    'a-dashboard': 'nav-adash',
    'h-register': 'nav-hreg',
    'a-register': 'nav-areg',
  };
  const navEl = document.getElementById(navIdMap[id]);
  if (navEl) navEl.classList.add('active');
  state.currentView = id;
  const navLinks = document.getElementById('navLinks');
  if (navLinks) navLinks.classList.remove('open');
  if (id === 'emergency') {
    if (typeof initCommandCenter === 'function') initCommandCenter();
    if (window.ccMap) { setTimeout(() => window.ccMap.invalidateSize(), 300); }
  }
  if (id === 'h-register' || id === 'a-register') loadRegisteredItems();
}

window.addEventListener('load', () => {
  const hash = (window.location.hash || '').replace('#', '');
  if (hash === 'map' || hash === 'emergency' || !hash) {
    showView('emergency');
  } else {
    showView(hash);
  }
});

window.addEventListener('hashchange', () => {
  const hash = (window.location.hash || '').replace('#', '');
  if (hash === 'map' || hash === 'emergency' || !hash) {
    showView('emergency');
  } else {
    showView(hash);
  }
});

function toggleNav() {
  document.getElementById('navLinks').classList.toggle('open');
}

// ── Language ─────────────────────────────────────────────────────
function setLang(lang) {
  state.selectedLang = lang;
  document.querySelectorAll('.lang-pill').forEach(p => p.classList.remove('active'));
  event.target.classList.add('active');
  const badge = document.getElementById('detected-lang');
  const labels = { auto:'🌐 Auto-detect', en:'🇬🇧 English', hi:'🇮🇳 Hindi', mr:'🇮🇳 Marathi', ta:'🇮🇳 Tamil', te:'🇮🇳 Telugu' };
  badge.textContent = labels[lang] || '🌐 Auto';
}

// ── Patient Count ────────────────────────────────────────────────
let patientCount = 1;
function changeCount(delta) {
  patientCount = Math.max(1, Math.min(20, patientCount + delta));
  document.getElementById('patientCount').textContent = patientCount;
}

// ── GPS ──────────────────────────────────────────────────────────
function getGPS() {
  if (!navigator.geolocation) { showToast('Geolocation not supported', 'error'); return; }
  showToast('Getting GPS location...', 'warning');
  navigator.geolocation.getCurrentPosition(
    pos => {
      state.userLat = pos.coords.latitude;
      state.userLng = pos.coords.longitude;
      document.getElementById('gpsInput').value = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
      showToast('📍 Location captured!', 'success');
    },
    () => {
      showToast('Could not get location. Using Mumbai default.', 'warning');
      document.getElementById('gpsInput').value = '19.0760, 72.8777';
    }
  );
}
function getRegGPS() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(pos => {
    document.getElementById('regGPS').value = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
  });
}

// ── Voice Input ──────────────────────────────────────────────────
function startVoiceInput() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    showToast('Voice input not supported in this browser. Use Chrome.', 'error'); return;
  }
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recog = new SpeechRecognition();
  recog.continuous = false;
  recog.interimResults = false;
  const langMap = { auto:'hi-IN', en:'en-IN', hi:'hi-IN', mr:'mr-IN', ta:'ta-IN', te:'te-IN' };
  recog.lang = langMap[state.selectedLang] || 'hi-IN';
  const btn = document.getElementById('voiceBtn');
  btn.classList.add('recording');
  btn.textContent = '🔴 Recording...';
  state.voiceActive = true;
  recog.start();
  recog.onresult = e => {
    const transcript = e.results[0][0].transcript;
    document.getElementById('emergencyInput').value = transcript;
    btn.classList.remove('recording');
    btn.textContent = '🎤 Voice';
    showToast('✅ Voice captured: "' + transcript.substring(0,40) + '..."', 'success');
  };
  recog.onerror = () => {
    btn.classList.remove('recording');
    btn.textContent = '🎤 Voice';
    showToast('Voice error. Please type instead.', 'error');
  };
  recog.onend = () => {
    btn.classList.remove('recording');
    btn.textContent = '🎤 Voice';
  };
}

function clearInput() {
  const textarea = document.getElementById('emergencyInput');
  textarea.value = '';
  textarea.dataset.prefilled = 'false';
}

// ── Offline Panel ────────────────────────────────────────────────
function toggleOfflinePanel() {
  const body = document.getElementById('offlineBody');
  const icon = document.getElementById('offline-toggle-icon');
  body.classList.toggle('hidden');
  icon.textContent = body.classList.contains('hidden') ? '▼' : '▲';
}

function simulateSMS() {
  const sms = document.getElementById('smsInput').value.trim();
  if (!sms.toLowerCase().startsWith('lifegrid')) {
    showToast('SMS must start with LIFEGRID', 'error'); return;
  }
  const content = sms.replace(/^lifegrid\s*/i, '');
  document.getElementById('emergencyInput').value = content;
  showToast('📥 SMS received and processed!', 'success');
  document.getElementById('offlineBody').classList.add('hidden');
}

function checkOffline() {
  if (!navigator.onLine) {
    state.offlineMode = true;
    updateOfflineBanner();
  }
}

function updateOfflineBanner() {
  const banner = document.getElementById('offline-banner');
  if (state.offlineMode) banner.classList.remove('hidden');
  else banner.classList.add('hidden');
}

function dismissOfflineBanner() {
  document.getElementById('offline-banner').classList.add('hidden');
}

// ── AI TRIAGE ENGINE ─────────────────────────────────────────────
function runTriage() {
  const text = document.getElementById('emergencyInput').value.trim();
  const district = document.getElementById('districtSelect').value;
  const location = document.getElementById('locationInput').value.trim();
  const gps = document.getElementById('gpsInput').value.trim();

  if (!text && !location) {
    showToast('Please describe the emergency or provide a location', 'error'); return;
  }

  // Parse GPS
  if (gps) {
    const parts = gps.split(',');
    if (parts.length === 2) {
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lng)) {
        state.userLat = lat;
        state.userLng = lng;
      }
    }
  } else if (district) {
    // Use district centroid
    const dist = HOSPITAL_DATA.find(h => h.district === district);
    if (dist) { state.userLat = dist.lat; state.userLng = dist.lng; }
  }

  // Show loading state
  const btn = document.getElementById('dispatchBtn');
  btn.innerHTML = '<span class="dispatch-icon">⏳</span><span class="dispatch-label">ANALYZING...</span>';
  btn.disabled = true;

  setTimeout(() => {
    const result = analyzeEmergency(text + ' ' + location, district);
    state.triageResult = result;
    displayTriageResults(result, district);
    btn.innerHTML = '<span class="dispatch-icon">🚨</span><span class="dispatch-label">INITIATE AI TRIAGE & DISPATCH</span><span class="dispatch-sub">Analyze · Match · Deploy</span>';
    btn.disabled = false;
  }, 1500);
}

function analyzeEmergency(text, district) {
  const lower = text.toLowerCase();
  let detectedConditions = [];
  let totalBoost = 0;
  let allNeeds = [];
  let primarySpecialist = null;

  // If emergency type was pre-selected, boost that symptom key first
  const preSelectedKey = state.emergencyType && state.emergencyType !== 'others'
    ? state.emergencyType : null;

  if (preSelectedKey && SYMPTOM_MAP[preSelectedKey]) {
    const data = SYMPTOM_MAP[preSelectedKey];
    detectedConditions.push({ condition: data.condition, specialist: data.specialist, needs: data.needs });
    totalBoost += data.severity_boost + 1; // +1 boost for explicit selection
    allNeeds = [...new Set([...allNeeds, ...data.needs])];
    primarySpecialist = data.specialist;
  }

  for (const [key, data] of Object.entries(SYMPTOM_MAP)) {
    if (key === preSelectedKey) continue; // already added
    for (const kw of data.keywords) {
      if (lower.includes(kw)) {
        detectedConditions.push({ condition: data.condition, specialist: data.specialist, needs: data.needs });
        totalBoost += data.severity_boost;
        allNeeds = [...new Set([...allNeeds, ...data.needs])];
        if (!primarySpecialist) primarySpecialist = data.specialist;
        break;
      }
    }
  }

  // Severity scoring
  let severity, severityScore;
  const criticalWords = ['critical','unconscious','behosh','no pulse','not breathing','severe','emergency','death','dying','mar raha'];
  const hasCritical = criticalWords.some(w => lower.includes(w));
  
  if (hasCritical || totalBoost >= 3) { severity = 'CRITICAL'; severityScore = 4; }
  else if (totalBoost >= 2) { severity = 'HIGH'; severityScore = 3; }
  else if (totalBoost >= 1) { severity = 'MODERATE'; severityScore = 2; }
  else { severity = 'LOW'; severityScore = 1; }

  if (detectedConditions.length === 0) {
    detectedConditions = [{ condition: 'General Emergency', specialist: 'Emergency Physician', needs: ['Emergency Room', 'Emergency Bed'] }];
    allNeeds = ['Emergency Room', 'Emergency Bed'];
    primarySpecialist = 'Emergency Physician';
  }

  // Find best hospitals
  const hospitals = findBestHospitals(district, primarySpecialist, severity, detectedConditions);
  // Dispatch ambulances with smart scoring
  const ambulances = dispatchAmbulances(patientCount, severity, detectedConditions);

  return { severity, severityScore, detectedConditions, allNeeds, primarySpecialist, hospitals, ambulances };
}

function calcDist(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function findBestHospitals(district, specialist, severity, conditions) {
  let pool = HOSPITAL_DATA;
  // Filter by district preference
  if (district) {
    const inDistrict = pool.filter(h => h.district === district);
    const nearby = pool.filter(h => h.district !== district);
    pool = [...inDistrict, ...nearby];
  }

  // Score each hospital
  const scored = pool.map(h => {
    const dist = calcDist(state.userLat, state.userLng, h.lat, h.lng);
    const distScore = Math.max(0, 100 - dist * 2);
    const hasSpec = h.specialties.includes(specialist) ? 30 : 0;
    const icuScore = (severity === 'CRITICAL' || severity === 'HIGH') && h.has_icu ? 25 : 0;
    const emergScore = h.has_emergency ? 15 : 0;
    const bloodScore = h.has_blood_bank ? 10 : 0;
    const bedScore = h.available_beds > 5 ? 10 : h.available_beds > 0 ? 5 : 0;
    const total = distScore + hasSpec + icuScore + emergScore + bloodScore + bedScore;
    return { ...h, dist: dist.toFixed(1), score: total };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5);
}

function scoreAmbulance(amb, dist, severity, conditions, emergencyTypeKey) {
  // Proximity score: 0–100 (closer = higher)
  const distScore = Math.max(0, 100 - dist * 2);

  // Availability: only 'available' pass filter already
  // Capacity score
  const capScore = amb.capacity >= patientCount ? 15 : amb.capacity >= 1 ? 5 : 0;

  // Type-match score based on severity + emergency type
  const typeWeights = { MICU: 35, ALS: 25, BLS: 10, NEO: 20 };
  let typeScore = typeWeights[amb.type] || 10;

  // Preferred types from emergency type selector
  const etKey = emergencyTypeKey || (conditions[0] && conditions[0].condition.toLowerCase().includes('obstetric') ? 'obstetric' : null);
  const etConfig = etKey ? EMERGENCY_TYPE_MAP[etKey] : null;
  if (etConfig && etConfig.preferredTypes.includes(amb.type)) {
    typeScore += 20; // big bonus for matching type
  }

  // Equipment match score: +5 per required equipment item found
  const requiredEquip = etConfig ? etConfig.requiredEquipment : [];
  // Also add condition-based required equipment
  const conditionEquip = conditions.flatMap(c => c.needs || []);
  const allRequiredEquip = [...new Set([...requiredEquip, ...conditionEquip])];
  let equipScore = 0;
  const ambEquipLower = (amb.equipment || []).map(e => e.toLowerCase());
  allRequiredEquip.forEach(req => {
    const reqLow = req.toLowerCase();
    if (ambEquipLower.some(e => e.includes(reqLow) || reqLow.includes(e.split(' ')[0]))) {
      equipScore += 5;
    }
  });
  equipScore = Math.min(equipScore, 40); // cap equipment bonus

  // Severity boost for advanced types
  let severityBonus = 0;
  if ((severity === 'CRITICAL' || severity === 'HIGH') && (amb.type === 'MICU' || amb.type === 'ALS')) {
    severityBonus = 15;
  }

  return distScore + typeScore + equipScore + capScore + severityBonus;
}

function dispatchAmbulances(count, severity, conditions) {
  const available = AMBULANCE_DATA.filter(a => a.status === 'available');
  if (available.length === 0) return [];

  let needed = Math.ceil(count / 2);
  if (severity === 'CRITICAL') needed = Math.max(needed, 1);

  // Score every available ambulance
  const scored = available.map(a => {
    const dist = calcDist(state.userLat, state.userLng, a.lat, a.lng);
    const score = scoreAmbulance(a, dist, severity, conditions, state.emergencyType);
    return { ...a, dist, ambScore: score };
  });

  // Sort by score descending (highest score = best match + closest)
  scored.sort((a, b) => b.ambScore - a.ambScore);

  // Always ensure at least one neonatal for obstetric emergencies
  const hasNeonatal = conditions.some(c => c.condition === 'Obstetric Emergency') ||
    state.emergencyType === 'obstetric';
  let selected = scored.slice(0, Math.max(needed, 1));
  if (hasNeonatal && !selected.find(s => s.type === 'NEO')) {
    const neo = scored.find(a => a.type === 'NEO');
    if (neo) selected.push(neo);
  }

  return selected.slice(0, Math.max(needed, 1));
}

// ── Display Triage Results ────────────────────────────────────────
function displayTriageResults(result, district) {
  const { severity, detectedConditions, allNeeds, hospitals, ambulances } = result;
  const container = document.getElementById('triageResults');
  container.classList.remove('hidden');

  // Scroll to results
  container.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Severity
  const sc = document.getElementById('severityCard');
  const sb = document.getElementById('severityBadge');
  const si = document.getElementById('severityInfo');
  sc.className = 'severity-card ' + severity.toLowerCase();
  sb.textContent = severity;

  const severityMessages = {
    CRITICAL: { title: '🔴 Critical Emergency — Immediate Dispatch Required', desc: 'Life-threatening condition detected. Multiple units being dispatched. Hospital pre-alert sent.' },
    HIGH:     { title: '🟠 High Severity — Rapid Response Initiated', desc: 'Serious condition detected. Priority dispatch in progress. Hospital notified.' },
    MODERATE: { title: '🟡 Moderate Severity — Response Dispatched', desc: 'Non-life-threatening but requires prompt medical attention. Ambulance dispatched.' },
    LOW:      { title: '🟢 Low Severity — Standard Response', desc: 'Condition assessed as stable. Ambulance and suitable facility identified.' }
  };
  const msg = severityMessages[severity];
  si.innerHTML = `<h3>${msg.title}</h3><p>${msg.desc}</p>`;

  // Detected conditions
  const dc = document.getElementById('detectedConditions');
  dc.innerHTML = '';
  detectedConditions.forEach(c => {
    dc.innerHTML += `<span class="tag red">${c.condition}</span>`;
    if (c.specialist) dc.innerHTML += `<span class="tag orange">Needs: ${c.specialist}</span>`;
  });
  allNeeds.forEach(n => {
    dc.innerHTML += `<span class="tag">${n}</span>`;
  });

  // Hospital results
  const hr = document.getElementById('hospitalResults');
  hr.innerHTML = '';
  hospitals.forEach((h, i) => {
    const etaMin = Math.round(parseFloat(h.dist) * 2.5 + 3);
    const isBest = i === 0;
    const specs = h.specialties.slice(0, 3).join(', ') || 'General';
    hr.innerHTML += `
      <div class="result-card ${isBest ? 'best' : ''}" onclick="openHospitalModal('${h.id}')">
        <div class="rc-header">
          <div class="rc-rank">${i+1}</div>
          <div>
            <div class="rc-name">${h.name}</div>
            <div class="rc-loc">📍 ${h.district}${h.address ? ' — ' + h.address.substring(0,40) : ''}</div>
          </div>
        </div>
        <div class="rc-meta">
          <span class="rc-badge dist">📏 ${h.dist} km</span>
          ${h.has_icu ? '<span class="rc-badge icu">🏥 ICU</span>' : ''}
          <span class="rc-badge beds">🛏️ ${h.available_beds} beds free</span>
          ${h.has_blood_bank ? '<span class="rc-badge spec">🩸 Blood Bank</span>' : ''}
          ${h.has_emergency ? '<span class="rc-badge type">🚨 Emergency</span>' : ''}
        </div>
        ${specs !== 'General' ? `<div class="rc-eta" style="margin-top:.35rem">⚕️ ${specs}</div>` : ''}
        <div class="rc-eta">⏱️ ETA: <strong>${etaMin} min</strong> by road</div>
      </div>`;
  });

  // Ambulance results
  const ar = document.getElementById('ambulanceResults');
  ar.innerHTML = '';
  if (ambulances.length === 0) {
    ar.innerHTML = '<div class="empty-state">No ambulances available</div>';
  } else {
    ambulances.forEach((a, i) => {
      const etaMin = Math.round(a.dist * 1.8 + 2);
      const scoreLabel = a.ambScore >= 120 ? '🏆 Best Match' : a.ambScore >= 90 ? '✅ Good Match' : '🔵 Available';
      const scoreBadge = a.ambScore >= 120
        ? '<span class="rc-badge" style="background:rgba(6,255,165,0.15);color:#06ffa5;border:1px solid rgba(6,255,165,0.4)">' + scoreLabel + '</span>'
        : a.ambScore >= 90
        ? '<span class="rc-badge" style="background:rgba(0,212,255,0.12);color:#00d4ff;border:1px solid rgba(0,212,255,0.3)">' + scoreLabel + '</span>'
        : '<span class="rc-badge type">' + scoreLabel + '</span>';
      ar.innerHTML += `
        <div class="result-card" onclick="openAmbulanceModal('${a.id}')">
          <div class="rc-header">
            <div class="rc-rank" style="background:rgba(230,57,70,0.15);border-color:rgba(230,57,70,0.4);color:var(--primary)">${i+1}</div>
            <div>
              <div class="rc-name">🚑 ${a.name} — ${a.type_label}</div>
              <div class="rc-loc">📍 ${a.district}${a.state ? ', ' + a.state : ''} | ${a.driver}</div>
            </div>
          </div>
          <div class="rc-meta">
            <span class="rc-badge type">Type: ${a.type}</span>
            <span class="rc-badge cap">👥 Cap: ${a.capacity}</span>
            <span class="rc-badge dist">📏 ${a.dist.toFixed(1)} km</span>
            ${scoreBadge}
          </div>
          <div class="rc-eta">⏱️ ETA: <strong>${etaMin} min</strong></div>
          <div class="rc-eta" style="font-size:.72rem;color:var(--text-dim)">Click to view details & 3D model</div>
        </div>`;
      // Mark as dispatched
      const idx = AMBULANCE_DATA.findIndex(x => x.id === a.id);
      if (idx >= 0) AMBULANCE_DATA[idx].status = 'dispatched';
    });
  }

  // Hospital alert preview
  const topHospital = hospitals[0];
  const etaMin = Math.round(parseFloat(topHospital?.dist || 10) * 2.5 + 3);
  const alertDiv = document.getElementById('alertContent');
  alertDiv.innerHTML = `
    <div class="alert-row"><span class="alert-key">Patient ID:</span><span class="alert-val">LGRD-${Date.now().toString().slice(-6)}</span></div>
    <div class="alert-row"><span class="alert-key">Severity:</span><span class="alert-val" style="color:var(--primary)">${severity}</span></div>
    <div class="alert-row"><span class="alert-key">Condition:</span><span class="alert-val">${detectedConditions.map(c=>c.condition).join(', ')}</span></div>
    <div class="alert-row"><span class="alert-key">Patients:</span><span class="alert-val">${patientCount}</span></div>
    <div class="alert-row"><span class="alert-key">ETA:</span><span class="alert-val" style="color:var(--success)">${etaMin} minutes</span></div>
    <div class="alert-row"><span class="alert-key">Ambulances:</span><span class="alert-val">${ambulances.map(a=>a.name).join(', ') || 'None dispatched'}</span></div>
    <div style="margin-top:.75rem; padding:.75rem; background:rgba(255,190,11,0.08); border-radius:8px; border:1px solid rgba(255,190,11,0.25)">
      <div style="color:var(--warning);font-weight:700;margin-bottom:.35rem">📋 Prepare:</div>
      ${allNeeds.map(n => `<span class="need-tag">${n}</span>`).join('')}
    </div>`;

  // Queue incoming alert in hospital dashboard
  if (topHospital) {
    queueIncomingAlert(topHospital, result, etaMin);
  }

  // 🗺️ Trigger animated dispatch on the Leaflet map
  if (ambulances.length > 0 && topHospital) {
    const primaryAmb = ambulances[0];
    // Small delay so user sees triage results first, then map auto-opens
    setTimeout(() => {
      triggerMapDispatch(primaryAmb, state.userLat, state.userLng, topHospital);
    }, 2500);
  }

  showToast(`✅ ${severity} emergency dispatched! ${ambulances.length} ambulance(s) en route. Map opening...`, 'success');
  updateStats();
}

function resetDispatch() {
  document.getElementById('triageResults').classList.add('hidden');
  document.getElementById('emergencyInput').value = '';
  document.getElementById('locationInput').value = '';
  document.getElementById('gpsInput').value = '';
  patientCount = 1;
  document.getElementById('patientCount').textContent = '1';
  // Reset emergency type selection
  state.emergencyType = null;
  document.querySelectorAll('.emergency-type-pill').forEach(p => p.classList.remove('active'));
  const ta = document.getElementById('emergencyInput');
  if (ta) ta.dataset.prefilled = 'false';
  // Reset dispatched ambulances
  AMBULANCE_DATA.forEach(a => { if (a.status === 'dispatched') a.status = 'available'; });
  updateStats();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Hospital Modal ────────────────────────────────────────────────
function openHospitalModal(id) {
  const h = HOSPITAL_DATA.find(x => x.id === id) || getRegisteredHospitals().find(x => x.id === id);
  if (!h) return;
  state.currentHospital = h;
  const modal = document.getElementById('hospitalModal');
  const content = document.getElementById('hospitalModalContent');
  
  const specs = h.specialties.length > 0 ? h.specialties : ['General Medicine'];
  const facs = h.facilities_raw ? h.facilities_raw.split(/[,\n]/).map(s=>s.trim()).filter(Boolean) : [];
  
  content.innerHTML = `
    <div style="clear:both">
      <h2 class="modal-h-name">${h.name}</h2>
      <p class="modal-h-loc">📍 ${h.address || ''}, ${h.district}${h.state ? ', ' + h.state : ''} ${h.pincode ? '— ' + h.pincode : ''}</p>
    </div>
    <div class="modal-grid">
      <div class="modal-info-box">
        <div class="mib-label">Category</div>
        <div class="mib-val">${h.category || 'N/A'}</div>
      </div>
      <div class="modal-info-box">
        <div class="mib-label">Total Beds</div>
        <div class="mib-val">${h.total_beds || 'N/A'}</div>
      </div>
      <div class="modal-info-box">
        <div class="mib-label">Available Beds</div>
        <div class="mib-val" style="color:var(--success)">${h.available_beds || 'N/A'}</div>
      </div>
      <div class="modal-info-box">
        <div class="mib-label">ICU Beds</div>
        <div class="mib-val" style="color:var(--purple)">${h.has_icu ? (h.icu_beds || 'Yes') : '—'}</div>
      </div>
      <div class="modal-info-box">
        <div class="mib-label">Emergency</div>
        <div class="mib-val" style="color:${h.has_emergency?'var(--success)':'var(--text-muted)'}">${h.has_emergency ? '✅ Available' : '❌ Not listed'}</div>
      </div>
      <div class="modal-info-box">
        <div class="mib-label">Blood Bank</div>
        <div class="mib-val" style="color:${h.has_blood_bank?'var(--success)':'var(--text-muted)'}">${h.has_blood_bank ? '✅ Available' : '❌ Not listed'}</div>
      </div>
      <div class="modal-info-box">
        <div class="mib-label">Phone</div>
        <div class="mib-val">${h.phone || h.emergency_num || 'N/A'}</div>
      </div>
      <div class="modal-info-box">
        <div class="mib-label">Emergency No.</div>
        <div class="mib-val" style="color:var(--primary)">${h.emergency_num || '—'}</div>
      </div>
    </div>
    <div class="modal-section">
      <h4>⚕️ Specialties Available</h4>
      <div class="tag-cloud">
        ${specs.map(s => `<span class="tag orange">${s}</span>`).join('')}
      </div>
    </div>
    ${facs.length > 0 ? `
    <div class="modal-section">
      <h4>🏥 Facilities</h4>
      <div class="tag-cloud">
        ${facs.map(f => `<span class="tag">${f}</span>`).join('')}
      </div>
    </div>` : ''}
    ${h.email ? `<div class="modal-section"><h4>📧 Contact</h4><span class="tag">${h.email}</span>${h.website?`<span class="tag">${h.website}</span>`:''}</div>` : ''}
    ${h.accreditation ? `<div class="modal-section"><h4>🏆 Accreditation</h4><span class="tag green">${h.accreditation}</span></div>` : ''}
    <div style="margin-top:1.5rem;display:flex;gap:.75rem;flex-wrap:wrap">
      ${h.emergency_num ? `<a href="tel:${h.emergency_num}" class="btn-secondary">📞 Call Emergency</a>` : ''}
      <button class="btn-secondary" onclick="sendHospitalAlert('${h.id}')">🚨 Send Alert to Hospital</button>
    </div>`;
  
  modal.classList.remove('hidden');
}

function closeHospitalModal(e) {
  if (!e || e.target === document.getElementById('hospitalModal')) {
    document.getElementById('hospitalModal').classList.add('hidden');
  }
}

function sendHospitalAlert(id) {
  showToast('🚨 Alert sent to hospital dashboard!', 'success');
  closeHospitalModal();
}

// ── Ambulance Modal + 3D ─────────────────────────────────────────
let renderer3D = null, scene3D = null, camera3D = null, animFrame = null;

function openAmbulanceModal(id) {
  const a = AMBULANCE_DATA.find(x => x.id === id) || getRegisteredAmbulances().find(x => x.id === id);
  if (!a) return;
  state.currentAmbulanceId = id;
  const modal = document.getElementById('ambulanceModal');
  const content = document.getElementById('ambulanceModalContent');

  const statusColor = { available: 'var(--success)', dispatched: 'var(--warning)', maintenance: 'var(--text-muted)' };
  const statusLabel = { available: '✅ Available', dispatched: '🚨 Dispatched', maintenance: '🔧 In Maintenance' };

  content.innerHTML = `
    <h2 class="modal-h-name">🚑 ${a.name}</h2>
    <p class="modal-h-loc">${a.type_label} | ${a.district}${a.state ? ', ' + a.state : ''} | Plate: ${a.license_plate}</p>
    <div class="modal-grid">
      <div class="modal-info-box">
        <div class="mib-label">Status</div>
        <div class="mib-val" style="color:${statusColor[a.status]}">${statusLabel[a.status]}</div>
      </div>
      <div class="modal-info-box">
        <div class="mib-label">Type</div>
        <div class="mib-val">${a.type_label}</div>
      </div>
      <div class="modal-info-box">
        <div class="mib-label">Capacity</div>
        <div class="mib-val">${a.capacity} patient${a.capacity > 1 ? 's' : ''}</div>
      </div>
      <div class="modal-info-box">
        <div class="mib-label">Vehicle Model</div>
        <div class="mib-val">${a.model} (${a.year})</div>
      </div>
      <div class="modal-info-box">
        <div class="mib-label">Driver</div>
        <div class="mib-val">${a.driver}</div>
      </div>
      <div class="modal-info-box">
        <div class="mib-label">Paramedic</div>
        <div class="mib-val">${a.paramedic}</div>
      </div>
      <div class="modal-info-box">
        <div class="mib-label">Driver Phone</div>
        <div class="mib-val"><a href="tel:${a.driver_phone}" style="color:var(--accent)">${a.driver_phone}</a></div>
      </div>
      <div class="modal-info-box">
        <div class="mib-label">Last Service</div>
        <div class="mib-val">${a.last_service}</div>
      </div>
    </div>
    <div class="modal-section">
      <h4>📦 Onboard Equipment (${a.equipment.length} items)</h4>
      <div class="equip-grid">
        ${a.equipment.map(e => `<div class="equip-item">${e}</div>`).join('')}
      </div>
    </div>`;

  modal.classList.remove('hidden');
  
  // Initialize 3D viewer
  setTimeout(() => init3DAmbulance(a), 100);
}

function closeAmbulanceModal(e) {
  if (!e || e.target === document.getElementById('ambulanceModal')) {
    document.getElementById('ambulanceModal').classList.add('hidden');
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
    if (renderer3D) { renderer3D.dispose(); renderer3D = null; }
  }
}

function open3DViewer(id) {
  openAmbulanceModal(id || state.currentAmbulanceId || 'AMB001');
}

function init3DAmbulance(ambulance) {
  const canvas = document.getElementById('ambulance3DCanvas');
  if (!canvas || !window.THREE) return;
  if (renderer3D) { renderer3D.dispose(); renderer3D = null; }
  if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }

  const W = canvas.clientWidth || 600, H = 350;
  canvas.width = W; canvas.height = H;

  scene3D = new THREE.Scene();
  scene3D.background = new THREE.Color(0x080a1a);
  
  camera3D = new THREE.PerspectiveCamera(55, W / H, 0.1, 100);
  camera3D.position.set(3, 2, 4);
  camera3D.lookAt(0, 0, 0);

  renderer3D = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer3D.setSize(W, H);
  renderer3D.shadowMap.enabled = true;
  renderer3D.shadowMap.type = THREE.PCFSoftShadowMap;

  // Lighting
  const ambient = new THREE.AmbientLight(0x223355, 1.2);
  scene3D.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xffffff, 2);
  dirLight.position.set(5, 8, 5);
  dirLight.castShadow = true;
  scene3D.add(dirLight);
  const pointLight = new THREE.PointLight(ambulance.color || '#00d4ff', 3, 15);
  pointLight.position.set(-3, 3, -2);
  scene3D.add(pointLight);
  const redLight = new THREE.PointLight(0xff0000, 2, 8);
  redLight.position.set(0, 2, 3);
  scene3D.add(redLight);

  // Build ambulance body
  const typeColors = {
    ALS: 0xe63946, BLS: 0x2196f3, MICU: 0x9c27b0, NEO: 0xff9800
  };
  const bodyColor = typeColors[ambulance.type] || 0xe63946;

  const mat = (color, emissive=0, opacity=1) => new THREE.MeshStandardMaterial({
    color, emissive, emissiveIntensity: 0.15, roughness: 0.4, metalness: 0.3,
    transparent: opacity < 1, opacity
  });

  // Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 1.3), mat(0xfafafa));
  body.position.set(0, 0.55, 0);
  body.castShadow = true;
  scene3D.add(body);

  // Cab
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.85, 1.3), mat(bodyColor));
  cab.position.set(-1.05, 0.43, 0);
  scene3D.add(cab);

  // Windshield
  const wind = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.55, 1.0), mat(0x88ccff, 0, 0.6));
  wind.position.set(-1.52, 0.45, 0);
  scene3D.add(wind);

  // Red stripe
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.18, 1.32), mat(bodyColor));
  stripe.position.set(0, 0.9, 0);
  scene3D.add(stripe);

  // Roof
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.35, 1.25), mat(0xfafafa));
  roof.position.set(0.3, 1.28, 0);
  scene3D.add(roof);

  // Wheels
  const wheelMat = mat(0x222222);
  const rimMat = mat(0x888888);
  [[-.75, -0.25, .72],[.75, -0.25, .72],[-.75, -0.25, -.72],[.75, -0.25, -.72]].forEach(([x,y,z]) => {
    const wg = new THREE.CylinderGeometry(0.32, 0.32, 0.18, 16);
    const wheel = new THREE.Mesh(wg, wheelMat);
    wheel.position.set(x,y,z);
    wheel.rotation.x = Math.PI/2;
    scene3D.add(wheel);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.15,0.2,8), rimMat);
    rim.position.set(x,y,z);
    rim.rotation.x = Math.PI/2;
    scene3D.add(rim);
  });

  // Emergency lights
  const lMat = new THREE.MeshStandardMaterial({ color:0xff0000, emissive:0xff0000, emissiveIntensity:1 });
  const rMat = new THREE.MeshStandardMaterial({ color:0x0044ff, emissive:0x0044ff, emissiveIntensity:1 });
  const flashL = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.12,0.3), lMat);
  flashL.position.set(-0.2, 1.5, 0.3);
  scene3D.add(flashL);
  const flashR = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.12,0.3), rMat);
  flashR.position.set(0.2, 1.5, 0.3);
  scene3D.add(flashR);

  // Labels (equipment dots on body)
  const dotMat = mat(bodyColor);
  ambulance.equipment.slice(0, 6).forEach((_, i) => {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), dotMat);
    dot.position.set(0.6 - i*0.25, 0.55, 0.68);
    scene3D.add(dot);
  });

  // Cross symbol
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.02), mat(0xff2222));
  crossH.position.set(0.5, 0.7, 0.66);
  scene3D.add(crossH);
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.02), mat(0xff2222));
  crossV.position.set(0.5, 0.7, 0.66);
  scene3D.add(crossV);

  // Grid floor
  const grid = new THREE.GridHelper(10, 20, 0x1a1a2e, 0x1a1a2e);
  grid.position.y = -0.27;
  scene3D.add(grid);

  // Orbit controls (manual)
  let isDragging = false, prevX = 0, prevY = 0;
  let rotX = 0.3, rotY = 0;
  let zoom = 5;
  const group = new THREE.Group();
  scene3D.children.filter(c => c !== ambient && c !== dirLight && c !== pointLight && c !== redLight && c !== grid).forEach(c => {
    scene3D.remove(c); group.add(c);
  });
  scene3D.add(group);

  canvas.addEventListener('mousedown', e => { isDragging = true; prevX = e.clientX; prevY = e.clientY; });
  canvas.addEventListener('mousemove', e => {
    if (!isDragging) return;
    rotY += (e.clientX - prevX) * 0.01;
    rotX += (e.clientY - prevY) * 0.005;
    rotX = Math.max(-0.5, Math.min(0.8, rotX));
    prevX = e.clientX; prevY = e.clientY;
  });
  canvas.addEventListener('mouseup', () => isDragging = false);
  canvas.addEventListener('wheel', e => { zoom = Math.max(2, Math.min(12, zoom + e.deltaY * 0.01)); });
  canvas.addEventListener('touchstart', e => { prevX = e.touches[0].clientX; prevY = e.touches[0].clientY; isDragging = true; });
  canvas.addEventListener('touchmove', e => {
    if (!isDragging) return;
    rotY += (e.touches[0].clientX - prevX) * 0.01;
    prevX = e.touches[0].clientX;
  });
  canvas.addEventListener('touchend', () => isDragging = false);

  let t = 0;
  function animate() {
    animFrame = requestAnimationFrame(animate);
    t += 0.03;
    if (!isDragging) rotY += 0.005;
    group.rotation.y = rotY;
    camera3D.position.set(Math.sin(0)*zoom, rotX * zoom * 0.6 + 1.5, Math.cos(0)*zoom);
    camera3D.position.x = Math.sin(rotY * 0) * zoom;
    // Flash lights
    flashL.material.emissiveIntensity = Math.sin(t * 8) > 0 ? 2 : 0.1;
    flashR.material.emissiveIntensity = Math.sin(t * 8) > 0 ? 0.1 : 2;
    camera3D.position.set(
      Math.sin(rotY) * zoom,
      Math.max(0.5, rotX) * 2 + 1,
      Math.cos(rotY) * zoom
    );
    camera3D.lookAt(0, 0.4, 0);
    renderer3D.render(scene3D, camera3D);
  }
  animate();
}

// ── MAP VIEW ──────────────────────────────────────────────────────
// ── LEAFLET MAP — All India Interactive ──────────────────────────

let leafletMap = null;
let hospitalMarkerLayer = null;
let ambulanceMarkers = [];
let dispatchRouteControl = null;
let dispatchAnimState = null;
let mapInitialized = false;

// All Indian states for dropdown
const INDIA_STATES = [
  'Andaman and Nicobar Islands','Andhra Pradesh','Arunachal Pradesh','Assam','Bihar',
  'Chandigarh','Chhattisgarh','Dadra and Nagar Haveli','Daman and Diu','Delhi',
  'Goa','Gujarat','Haryana','Himachal Pradesh','Jammu and Kashmir','Jharkhand',
  'Karnataka','Kerala','Lakshadweep','Madhya Pradesh','Maharashtra','Manipur',
  'Meghalaya','Mizoram','Nagaland','Odisha','Puducherry','Punjab','Rajasthan',
  'Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'
];

function initMap() {
  if (mapInitialized && leafletMap) {
    leafletMap.invalidateSize();
    return;
  }
  const container = document.getElementById('leafletMap');
  if (!container || typeof L === 'undefined') {
    setTimeout(initMap, 500); return;
  }

  // Init Leaflet map centered on India
  leafletMap = L.map('leafletMap', {
    center: [20.5937, 78.9629],
    zoom: 5,
    zoomControl: false,
  });

  // Dark-themed tile layer (CartoDB Dark Matter)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CARTO',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(leafletMap);

  // Zoom control bottom-right
  L.control.zoom({ position: 'bottomright' }).addTo(leafletMap);

  // Add ambulance positions
  addAmbulanceMarkersToMap();

  // Init state dropdown
  const stateFilter = document.getElementById('mapStateFilter');
  if (stateFilter && stateFilter.options.length <= 1) {
    INDIA_STATES.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s; opt.textContent = s;
      stateFilter.appendChild(opt);
    });
  }

  mapInitialized = true;
  filterMap(); // initial load
}

function filterMap() {
  if (!leafletMap) return;
  const stateVal = (document.getElementById('mapStateFilter') || {}).value || '';
  const typeVal  = (document.getElementById('mapTypeFilter') || {}).value || '';
  const search   = ((document.getElementById('mapSearchInput') || {}).value || '').toLowerCase().trim();

  let hospitals = [...HOSPITAL_DATA, ...getRegisteredHospitals()];
  if (stateVal)  hospitals = hospitals.filter(h => h.state === stateVal);
  if (typeVal === 'icu')        hospitals = hospitals.filter(h => h.has_icu);
  else if (typeVal === 'emergency')  hospitals = hospitals.filter(h => h.has_emergency);
  else if (typeVal === 'ambulance')  hospitals = hospitals.filter(h => h.has_ambulance);
  else if (typeVal === 'bloodbank')  hospitals = hospitals.filter(h => h.has_blood_bank);
  if (search) hospitals = hospitals.filter(h =>
    h.name.toLowerCase().includes(search) ||
    (h.district||'').toLowerCase().includes(search) ||
    (h.state||'').toLowerCase().includes(search)
  );

  state.mapHospitals = hospitals;
  renderLeafletHospitals(hospitals);
  updateMapStats(hospitals);

  // Pan to state if selected
  if (stateVal) {
    const sample = hospitals[0];
    if (sample) leafletMap.setView([sample.lat, sample.lng], 8);
  }
}

function searchMapHospitals() { filterMap(); }

function renderLeafletHospitals(hospitals) {
  if (!leafletMap) return;

  // Remove old layer
  if (hospitalMarkerLayer) {
    leafletMap.removeLayer(hospitalMarkerLayer);
    hospitalMarkerLayer = null;
  }

  // Limit for performance: cluster if too many
  const maxMarkers = 2000;
  const shown = hospitals.slice(0, maxMarkers);

  const markers = shown.map(h => {
    let color;
    if (h.has_icu)          color = '#b388ff';
    else if (h.has_emergency) color = '#e63946';
    else if (h.has_blood_bank)color = '#ff9800';
    else if (h.has_ambulance) color = '#00d4ff';
    else if (h.specialties && h.specialties.length > 0) color = '#ffbe0b';
    else                       color = '#06ffa5';

    const radius = h.has_icu ? 7 : 5;
    const circle = L.circleMarker([h.lat, h.lng], {
      radius,
      fillColor: color,
      fillOpacity: 0.85,
      color: 'rgba(255,255,255,0.4)',
      weight: 1,
    });

    const specs = (h.specialties || []).slice(0,3).join(', ') || 'General';
    const tagHtml = `
      ${h.has_icu ? '<span class="lpop-tag" style="background:rgba(179,136,255,0.2);color:#b388ff">ICU</span>' : ''}
      ${h.has_emergency ? '<span class="lpop-tag" style="background:rgba(230,57,70,0.15);color:#e63946">Emergency</span>' : ''}
      ${h.has_blood_bank ? '<span class="lpop-tag" style="background:rgba(255,152,0,0.15);color:#ff9800">Blood Bank</span>' : ''}
      ${h.has_ambulance ? '<span class="lpop-tag" style="background:rgba(0,212,255,0.1);color:#00d4ff">Ambulance</span>' : ''}
    `;
    circle.bindPopup(`
      <div class="lpop-name">${h.name}</div>
      <div class="lpop-loc">📍 ${h.district || ''}, ${h.state || ''}</div>
      <div class="lpop-tags">${tagHtml}</div>
      <div style="font-size:.75rem;color:#8891aa;margin-bottom:.35rem">🛏️ ${h.available_beds} beds free &nbsp;⚕️ ${specs}</div>
      ${h.phone ? `<div style="font-size:.75rem;color:#8891aa">📞 ${h.phone}</div>` : ''}
      <button class="lpop-btn btn-secondary" style="font-size:.72rem;padding:.3rem .75rem;margin-top:.5rem"
        onclick="openHospitalModal('${h.id}')">View Details</button>
    `, { maxWidth: 260 });

    return circle;
  });

  hospitalMarkerLayer = L.layerGroup(markers);
  hospitalMarkerLayer.addTo(leafletMap);
}

function addAmbulanceMarkersToMap() {
  if (!leafletMap) return;
  ambulanceMarkers.forEach(m => { if (leafletMap.hasLayer(m)) leafletMap.removeLayer(m); });
  ambulanceMarkers = [];
  AMBULANCE_DATA.filter(a => a.status === 'available').forEach(a => {
    const icon = L.divIcon({
      html: '<div class="ambulance-marker-icon">🚑</div>',
      className: '', iconSize: [28, 28], iconAnchor: [14, 14]
    });
    const marker = L.marker([a.lat, a.lng], { icon });
    marker.bindPopup(`
      <div class="lpop-name">🚑 ${a.name}</div>
      <div class="lpop-loc">${a.type_label} | ${a.district}</div>
      <div class="lpop-tags">
        <span class="lpop-tag" style="background:rgba(230,57,70,0.15);color:#e63946">${a.type}</span>
        <span class="lpop-tag" style="background:rgba(6,255,165,0.1);color:#06ffa5">Cap: ${a.capacity}</span>
      </div>
      <div style="font-size:.75rem;color:#8891aa">Driver: ${a.driver}</div>
      <button class="lpop-btn btn-secondary" style="font-size:.72rem;padding:.3rem .75rem;margin-top:.5rem"
        onclick="openAmbulanceModal('${a.id}')">View Details & 3D</button>
    `);
    marker.addTo(leafletMap);
    ambulanceMarkers.push(marker);
  });
}

function updateMapStats(hospitals) {
  document.getElementById('ms1').textContent = hospitals.length;
  document.getElementById('ms2').textContent = hospitals.filter(h=>h.has_icu).length;
  document.getElementById('ms3').textContent = hospitals.filter(h=>h.has_emergency).length;
  document.getElementById('ms4').textContent = hospitals.filter(h=>h.has_blood_bank).length;
}

// ── ANIMATED AMBULANCE DISPATCH ────────────────────────────────────

let activeDispatchMarkers = [];
let activeRouteLayer = null;
let dispatchAnimInterval = null;

function startDispatchAnimation(ambulance, patientLat, patientLng, hospital) {
  if (!leafletMap) {
    // Switch to map view first
    showView('map');
    setTimeout(() => startDispatchAnimation(ambulance, patientLat, patientLng, hospital), 800);
    return;
  }

  // Clean up previous dispatch
  cleanupDispatch();

  // Show dispatch live panel
  const panel = document.getElementById('dispatchLivePanel');
  panel.classList.remove('hidden');
  resetDispatchSteps();

  const ambLat = ambulance.lat, ambLng = ambulance.lng;

  // Create ambulance moving marker
  const ambIcon = L.divIcon({
    html: '<div class="ambulance-marker-icon" style="font-size:26px">🚑</div>',
    className: '', iconSize: [32, 32], iconAnchor: [16, 16]
  });

  // Patient marker
  const patIcon = L.divIcon({
    html: '<div class="patient-marker-icon">🔴</div>',
    className: '', iconSize: [24, 24], iconAnchor: [12, 12]
  });

  // Hospital destination marker
  const hospIcon = L.divIcon({
    html: '<div class="hospital-dest-icon">🏥</div>',
    className: '', iconSize: [32, 32], iconAnchor: [16, 32]
  });

  const patMarker = L.marker([patientLat, patientLng], { icon: patIcon })
    .addTo(leafletMap)
    .bindPopup('<div class="lpop-name">🔴 Patient Location</div><div class="lpop-loc">Awaiting pickup</div>');

  const hospMarker = L.marker([hospital.lat, hospital.lng], { icon: hospIcon })
    .addTo(leafletMap)
    .bindPopup(`<div class="lpop-name">🏥 ${hospital.name}</div><div class="lpop-loc">Destination Hospital</div>`);

  const movingAmb = L.marker([ambLat, ambLng], { icon: ambIcon })
    .addTo(leafletMap)
    .bindPopup(`<div class="lpop-name">🚑 ${ambulance.name}</div><div class="lpop-loc">${ambulance.type_label}</div><div style="font-size:.75rem;color:#06ffa5">▶ EN ROUTE</div>`);

  activeDispatchMarkers = [patMarker, hospMarker, movingAmb];

  // Fit map to show all points
  const bounds = L.latLngBounds([
    [ambLat, ambLng], [patientLat, patientLng], [hospital.lat, hospital.lng]
  ]);
  leafletMap.fitBounds(bounds, { padding: [60, 60], maxZoom: 12 });

  // Phase 1: Ambulance → Patient (smooth interpolation)
  document.getElementById('dlpPhase').textContent = '🚑 Ambulance en route to patient...';
  setDispatchStep(1, 'active');

  const ETA1 = calcDist(ambLat, ambLng, patientLat, patientLng);
  const ETA2 = calcDist(patientLat, patientLng, hospital.lat, hospital.lng);
  const totalETA = Math.round((ETA1 + ETA2) * 2.5 + 5);
  document.getElementById('dlpETA').textContent = `⏱️ Total ETA: ~${totalETA} min`;

  // Draw route line (simplified: direct line, dotted)
  const routeLine1 = L.polyline([[ambLat, ambLng], [patientLat, patientLng]], {
    color: '#ffbe0b', weight: 3, opacity: 0.8, dashArray: '8 6'
  }).addTo(leafletMap);

  const routeLine2 = L.polyline([[patientLat, patientLng], [hospital.lat, hospital.lng]], {
    color: '#e63946', weight: 3, opacity: 0.6, dashArray: '8 6'
  }).addTo(leafletMap);

  activeDispatchMarkers.push(routeLine1, routeLine2);

  // Attempt road routing via OSRM if available
  tryOSRMRouting(ambLat, ambLng, patientLat, patientLng, hospital.lat, hospital.lng,
    movingAmb, patMarker, panel, ambulance, hospital, totalETA);
}

function tryOSRMRouting(ambLat, ambLng, patLat, patLng, hospLat, hospLng,
  movingAmb, patMarker, panel, ambulance, hospital, totalETA) {

  // Use OSRM public API for routing
  const url = `https://router.project-osrm.org/route/v1/driving/` +
    `${ambLng},${ambLat};${patLng},${patLat};${hospLng},${hospLat}` +
    `?overview=full&geometries=geojson&steps=false`;

  fetch(url)
    .then(r => r.json())
    .then(data => {
      if (data.routes && data.routes[0]) {
        const coords = data.routes[0].geometry.coordinates;
        // Convert [lng,lat] to [lat,lng] for Leaflet
        const latLngs = coords.map(c => [c[1], c[0]]);
        animateAlongRoute(latLngs, movingAmb, patMarker, panel, ambulance, hospital, totalETA);
      } else {
        animateFallback(ambLat, ambLng, patLat, patLng, hospLat, hospLng,
          movingAmb, patMarker, panel, ambulance, hospital, totalETA);
      }
    })
    .catch(() => {
      animateFallback(ambLat, ambLng, patLat, patLng, hospLat, hospLng,
        movingAmb, patMarker, panel, ambulance, hospital, totalETA);
    });
}

function animateAlongRoute(routePoints, movingAmb, patMarker, panel, ambulance, hospital, totalETA) {
  // Remove old dashed lines
  activeDispatchMarkers.forEach(m => {
    if (m instanceof L.Polyline) leafletMap.removeLayer(m);
  });

  // Draw actual road route — phase 1: amb→patient (find ~midpoint)
  // Find approximate split point (patient is waypoint 2 in route)
  // For simplicity: first half = amb to patient, second half = patient to hospital
  const half = Math.floor(routePoints.length / 2);
  const phase1 = routePoints.slice(0, half + 1);
  const phase2 = routePoints.slice(half);

  const roadLine1 = L.polyline(phase1, {
    color: '#ffbe0b', weight: 4, opacity: 0.9
  }).addTo(leafletMap);

  const roadLine2 = L.polyline(phase2, {
    color: '#e63946', weight: 4, opacity: 0.7
  }).addTo(leafletMap);

  activeDispatchMarkers.push(roadLine1, roadLine2);

  animateMarkerAlongPoints(movingAmb, phase1, 40, () => {
    // Reached patient
    setDispatchStep(1, 'done'); setDispatchStep(2, 'done');
    setDispatchStep(3, 'active');
    document.getElementById('dlpPhase').textContent = '🔴 Picking up patient...';
    document.getElementById('dlpETA').textContent = `⏱️ Transporting to ${hospital.name}`;

    // Blink patient marker then remove
    patMarker.setOpacity(0);
    setTimeout(() => {
      setDispatchStep(3, 'done'); setDispatchStep(4, 'active');
      document.getElementById('dlpPhase').textContent = '🏥 En route to hospital...';

      animateMarkerAlongPoints(movingAmb, phase2, 35, () => {
        setDispatchStep(4, 'done'); setDispatchStep(5, 'active');
        document.getElementById('dlpPhase').textContent = '✅ Patient delivered!';
        document.getElementById('dlpETA').textContent = '✅ Mission Complete';
        setDispatchStep(5, 'done');
        movingAmb.setOpacity(0.4);
        showToast('✅ Patient successfully delivered to ' + hospital.name, 'success');
      });
    }, 2000);
  });
}

function animateFallback(ambLat, ambLng, patLat, patLng, hospLat, hospLng,
  movingAmb, patMarker, panel, ambulance, hospital, totalETA) {
  // Simple linear interpolation fallback
  const phase1 = interpolatePoints(ambLat, ambLng, patLat, patLng, 30);
  const phase2 = interpolatePoints(patLat, patLng, hospLat, hospLng, 30);
  animateMarkerAlongPoints(movingAmb, phase1, 60, () => {
    setDispatchStep(1, 'done'); setDispatchStep(2, 'done');
    setDispatchStep(3, 'active');
    document.getElementById('dlpPhase').textContent = '🔴 Picking up patient...';
    patMarker.setOpacity(0);
    setTimeout(() => {
      setDispatchStep(3, 'done'); setDispatchStep(4, 'active');
      document.getElementById('dlpPhase').textContent = '🏥 En route to hospital...';
      animateMarkerAlongPoints(movingAmb, phase2, 50, () => {
        setDispatchStep(4, 'done'); setDispatchStep(5, 'active');
        document.getElementById('dlpPhase').textContent = '✅ Patient delivered!';
        document.getElementById('dlpETA').textContent = '✅ Mission Complete';
        setDispatchStep(5, 'done');
        movingAmb.setOpacity(0.4);
        showToast('✅ Patient delivered to ' + hospital.name, 'success');
      });
    }, 2000);
  });
}

function interpolatePoints(lat1, lng1, lat2, lng2, steps) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Add slight curve offset
    const mid = i === Math.floor(steps/2);
    const offsetLat = mid ? (Math.random()-0.5)*0.05 : 0;
    const offsetLng = mid ? (Math.random()-0.5)*0.05 : 0;
    pts.push([lat1 + (lat2-lat1)*t + offsetLat, lng1 + (lng2-lng1)*t + offsetLng]);
  }
  return pts;
}

function animateMarkerAlongPoints(marker, points, delayMs, onComplete) {
  let i = 0;
  if (dispatchAnimInterval) clearInterval(dispatchAnimInterval);

  dispatchAnimInterval = setInterval(() => {
    if (i >= points.length) {
      clearInterval(dispatchAnimInterval);
      if (onComplete) onComplete();
      return;
    }
    marker.setLatLng(points[i]);
    // Rotate icon to show direction
    if (i > 0) {
      const dx = points[i][1] - points[i-1][1];
      const dy = points[i][0] - points[i-1][0];
      const angle = Math.atan2(dx, dy) * 180 / Math.PI;
      const el = marker.getElement();
      if (el) el.style.transform = `rotate(${angle}deg)`;
    }
    i++;
  }, delayMs);
}

function setDispatchStep(num, status) {
  const el = document.getElementById(`dlpStep${num}`);
  if (!el) return;
  el.className = 'dlp-step ' + status;
}

function resetDispatchSteps() {
  for (let i = 1; i <= 5; i++) setDispatchStep(i, '');
  setDispatchStep(1, 'active');
}

function closeDispatchPanel() {
  document.getElementById('dispatchLivePanel').classList.add('hidden');
}

function cleanupDispatch() {
  if (dispatchAnimInterval) { clearInterval(dispatchAnimInterval); dispatchAnimInterval = null; }
  activeDispatchMarkers.forEach(m => { if (leafletMap && leafletMap.hasLayer(m)) leafletMap.removeLayer(m); });
  activeDispatchMarkers = [];
}

function replayDispatch() {
  if (dispatchAnimState) {
    const { ambulance, patLat, patLng, hospital } = dispatchAnimState;
    resetDispatchSteps();
    startDispatchAnimation(ambulance, patLat, patLng, hospital);
  }
}

// Called after triage results to kick off map animation
function triggerMapDispatch(ambulance, patLat, patLng, hospital) {
  dispatchAnimState = { ambulance, patLat, patLng, hospital };
  // Switch to map view and animate
  showView('map');
  setTimeout(() => startDispatchAnimation(ambulance, patLat, patLng, hospital), 600);
}


// ── HOSPITAL DASHBOARD ────────────────────────────────────────────
function loginHospital() {
  const id = document.getElementById('hLoginId').value.trim();
  const pass = document.getElementById('hLoginPass').value.trim();
  
  let hospital = HOSPITAL_DATA.find(h => h.id === id && h.password === pass);
  if (!hospital) hospital = getRegisteredHospitals().find(h => h.id === id && h.password === pass);
  if (!hospital) {
    // Demo fallback: any H-ID with matching format
    hospital = HOSPITAL_DATA.find(h => h.id === id);
    if (hospital && pass === hospital.password) {
      // ok
    } else if (hospital && pass.startsWith('hosp')) {
      // allow demo
    } else {
      showToast('Invalid credentials. Try H15780 / hosp15780', 'error'); return;
    }
  }

  state.dashHospital = hospital;
  document.getElementById('hDashLogin').classList.add('hidden');
  document.getElementById('hDashContent').classList.remove('hidden');
  populateHospitalDashboard(hospital);
}

function populateHospitalDashboard(h) {
  document.getElementById('dashHospitalName').textContent = h.name;
  document.getElementById('dashHospitalLoc').textContent = `📍 ${h.district}${h.state ? ', ' + h.state : ''}`;
  
  const occupied = h.total_beds - h.available_beds;
  document.getElementById('dscAvailBeds').textContent = h.available_beds;
  document.getElementById('dscOccupied').textContent = occupied;
  document.getElementById('dscICU').textContent = h.has_icu ? h.available_icu : '—';
  document.getElementById('dscDoctors').textContent = h.doctors || 'N/A';

  // Incoming alerts
  renderIncomingAlerts(h);

  // Bed management
  renderBedGrid(h);

  // Specialties
  const sf = document.getElementById('specFacilities');
  const specs = h.specialties.length > 0 ? h.specialties : ['General Medicine'];
  sf.innerHTML = specs.map(s => `<span class="tag orange">${s}</span>`).join('');
  if (h.has_icu) sf.innerHTML += '<span class="tag purple">ICU</span>';
  if (h.has_blood_bank) sf.innerHTML += '<span class="tag red">Blood Bank</span>';
  if (h.has_emergency) sf.innerHTML += '<span class="tag green">Emergency Room</span>';
  if (h.has_ambulance) sf.innerHTML += '<span class="tag">Ambulance</span>';

  // Live updates simulation
  startLiveUpdates(h);
}

function renderBedGrid(h) {
  const bedGrid = document.getElementById('bedManagement');
  bedGrid.innerHTML = '';
  if (!state.bedStates[h.id]) {
    state.bedStates[h.id] = {};
    const total = Math.min(h.total_beds, 60);
    for (let i = 1; i <= total; i++) {
      const isICU = h.has_icu && i <= h.icu_beds;
      const isOccupied = i > h.available_beds;
      state.bedStates[h.id][i] = isICU ? 'icu' : (isOccupied ? 'occupied' : 'available');
    }
  }
  Object.entries(state.bedStates[h.id]).forEach(([num, st]) => {
    const cell = document.createElement('div');
    cell.className = `bed-cell ${st}`;
    cell.innerHTML = `<span class="bed-icon">${st==='available'?'🛏️':st==='icu'?'🏥':'⛔'}</span><span>${num}</span>`;
    cell.title = `Bed ${num} — ${st}`;
    cell.onclick = () => toggleBed(h.id, num);
    bedGrid.appendChild(cell);
  });
  updateBedStats(h.id);
}

function toggleBed(hId, num) {
  const current = state.bedStates[hId][num];
  const next = current === 'available' ? 'occupied' : 'available';
  state.bedStates[hId][num] = next;
  if (state.dashHospital) {
    renderBedGrid(state.dashHospital);
  }
}

function updateBedStats(hId) {
  const beds = Object.values(state.bedStates[hId] || {});
  const available = beds.filter(b => b === 'available').length;
  const occupied = beds.filter(b => b === 'occupied').length;
  const icu = beds.filter(b => b === 'icu').length;
  document.getElementById('dscAvailBeds').textContent = available;
  document.getElementById('dscOccupied').textContent = occupied;
  document.getElementById('dscICU').textContent = icu || '—';
}

function renderIncomingAlerts(h) {
  const container = document.getElementById('incomingAlerts');
  if (state.incomingAlerts.length === 0) {
    container.innerHTML = '<div class="empty-state">No incoming emergencies at this time</div>';
    return;
  }
  container.innerHTML = state.incomingAlerts.map(alert => `
    <div class="alert-card">
      <div class="alert-card-header">
        <span class="alert-severity critical">${alert.severity}</span>
        <span style="font-size:.78rem;color:var(--text-muted)">ID: ${alert.id}</span>
        <span class="alert-eta">⏱️ ETA: ${alert.eta} min</span>
      </div>
      <h4>${alert.conditions}</h4>
      <p>${alert.patients} patient(s) incoming | ${alert.ambulances}</p>
      <div class="alert-needs">
        ${alert.needs.map(n=>`<span class="need-tag">${n}</span>`).join('')}
      </div>
    </div>`).join('');
}

function queueIncomingAlert(hospital, result, eta) {
  state.incomingAlerts.unshift({
    id: 'LGRD-' + Date.now().toString().slice(-6),
    severity: result.severity,
    conditions: result.detectedConditions.map(c=>c.condition).join(', '),
    patients: patientCount,
    ambulances: result.ambulances.map(a=>a.name).join(', ') || 'TBD',
    needs: result.allNeeds.slice(0, 5),
    eta
  });
  if (state.incomingAlerts.length > 5) state.incomingAlerts.pop();
}

let liveUpdateInterval = null;
function startLiveUpdates(h) {
  if (liveUpdateInterval) clearInterval(liveUpdateInterval);
  liveUpdateInterval = setInterval(() => {
    if (!state.dashHospital || document.getElementById('hDashContent').classList.contains('hidden')) {
      clearInterval(liveUpdateInterval); return;
    }
    // Random bed change simulation
    const beds = state.bedStates[h.id];
    if (beds) {
      const keys = Object.keys(beds);
      const randomBed = keys[Math.floor(Math.random() * keys.length)];
      if (beds[randomBed] !== 'icu') {
        beds[randomBed] = beds[randomBed] === 'available' ? 'occupied' : 'available';
        renderBedGrid(h);
      }
    }
  }, 8000);
}

function logoutHospital() {
  state.dashHospital = null;
  if (liveUpdateInterval) clearInterval(liveUpdateInterval);
  document.getElementById('hDashLogin').classList.remove('hidden');
  document.getElementById('hDashContent').classList.add('hidden');
  document.getElementById('hLoginId').value = '';
  document.getElementById('hLoginPass').value = '';
}

// ── AMBULANCE DASHBOARD ───────────────────────────────────────────
function loginAmbulance() {
  const id = document.getElementById('aLoginId').value.trim().toUpperCase();
  const pass = document.getElementById('aLoginPass').value.trim();
  
  let amb = AMBULANCE_DATA.find(a => a.id === id && a.password === pass);
  if (!amb) amb = getRegisteredAmbulances().find(a => a.id === id && a.password === pass);
  if (!amb) {
    showToast('Invalid credentials. Try AMB001 / amb001pass', 'error'); return;
  }

  state.dashAmbulance = amb;
  state.currentAmbulanceId = amb.id;
  document.getElementById('aDashLogin').classList.add('hidden');
  document.getElementById('aDashContent').classList.remove('hidden');
  populateAmbulanceDashboard(amb);
}

function populateAmbulanceDashboard(a) {
  document.getElementById('aDashName').textContent = `🚑 ${a.name}`;
  document.getElementById('aDashType').textContent = `${a.type_label} | ${a.model}`;
  
  const statusLabel = { available: '✅ Available', dispatched: '🚨 Dispatched', maintenance: '🔧 Maintenance' };
  document.getElementById('aDscStatus').textContent = statusLabel[a.status] || a.status;
  document.getElementById('aDscCap').textContent = a.capacity + ' patients';
  document.getElementById('aDscDistrict').textContent = a.district;
  document.getElementById('aDscLastService').textContent = a.last_service;

  const equip = document.getElementById('aEquipList');
  equip.innerHTML = a.equipment.map(e => `<div class="equip-item">${e}</div>`).join('');

  const mission = document.getElementById('aMission');
  if (a.status === 'dispatched') {
    mission.innerHTML = `
      <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.75rem">
        <span style="font-size:2rem">🚨</span>
        <div>
          <div style="font-weight:700;color:var(--primary)">ACTIVE MISSION</div>
          <div style="font-size:.82rem;color:var(--text-muted)">Dispatched — En route to incident</div>
        </div>
      </div>
      <div style="font-size:.85rem;color:var(--text-muted)">Check main dispatch for details</div>`;
  } else {
    mission.innerHTML = '<div class="empty-state">No active mission assigned</div>';
  }
}

function logoutAmbulance() {
  state.dashAmbulance = null;
  document.getElementById('aDashLogin').classList.remove('hidden');
  document.getElementById('aDashContent').classList.add('hidden');
  document.getElementById('aLoginId').value = '';
  document.getElementById('aLoginPass').value = '';
}

// ── REGISTRATION ──────────────────────────────────────────────────
function submitHospitalReg(e) {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form));
  
  if (data.password !== data.confirm_password) {
    showToast('Passwords do not match!', 'error'); return;
  }

  const specs = [...form.querySelectorAll('.spec-cb input[data-type="spec"]:checked')].map(i=>i.value);
  const facs = [...form.querySelectorAll('.spec-cb input[data-type="fac"]:checked')].map(i=>i.value);
  
  const id = 'H-REG-' + Date.now().toString().slice(-6);
  const newHospital = {
    id, name: data.name, address: data.address, district: data.district,
    subdistrict: data.subdistrict || '', pincode: data.pincode,
    lat: parseFloat((data.coordinates||'').split(',')[0]) || 18.52,
    lng: parseFloat((data.coordinates||'').split(',')[1]) || 73.86,
    category: data.category, care_type: 'Hospital',
    phone: data.phone, mobile: data.mobile || '',
    emergency_num: data.emergency_num || '', email: data.email, website: data.website || '',
    specialties: specs, facilities_raw: facs.join(', '),
    has_icu: facs.includes('ICU'), has_blood_bank: facs.includes('Blood Bank'),
    has_ambulance: facs.includes('Ambulance'), has_emergency: !!data.emergency_num,
    total_beds: parseInt(data.total_beds) || 30,
    available_beds: Math.floor((parseInt(data.total_beds)||30) * 0.35),
    icu_beds: parseInt(data.icu_beds) || 0,
    available_icu: Math.floor((parseInt(data.icu_beds)||0) * 0.4),
    doctors: parseInt(data.doctors) || 0,
    accreditation: data.accreditation || '', established: data.established || '',
    password: data.password,
    nodal: { name: data.nodal_name, phone: data.nodal_phone, email: data.nodal_email || '' },
    registered_at: new Date().toISOString()
  };

  const registered = getRegisteredHospitals();
  registered.push(newHospital);
  localStorage.setItem('lifegrid_hospitals', JSON.stringify(registered));
  
  form.reset();
  showToast(`✅ Hospital registered! Your ID: ${id}`, 'success');
  loadRegisteredItems();
}

function submitAmbulanceReg(e) {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form));
  
  if (data.password !== data.confirm_password) {
    showToast('Passwords do not match!', 'error'); return;
  }

  const equip = [...form.querySelectorAll('#ambulanceEquipChecklist input:checked')].map(i=>i.value);
  const id = 'AMB-R-' + Date.now().toString().slice(-4);
  const newAmb = {
    id, name: data.name, type: data.type,
    type_label: { BLS:'Basic Life Support', ALS:'Advanced Life Support', MICU:'Mobile ICU', NEO:'Neonatal Ambulance' }[data.type] || data.type,
    driver: data.driver, driver_phone: data.driver_phone,
    paramedic: data.paramedic,
    capacity: parseInt(data.capacity) || 2,
    status: 'available', lat: 18.52, lng: 73.86,
    district: data.district, model: data.model,
    year: parseInt(data.year) || 2023,
    license_plate: data.license_plate,
    last_service: new Date().toISOString().slice(0,10),
    equipment: equip, color: '#2196f3',
    password: data.password,
    registered_at: new Date().toISOString()
  };

  const registered = getRegisteredAmbulances();
  registered.push(newAmb);
  localStorage.setItem('lifegrid_ambulances', JSON.stringify(registered));
  
  form.reset();
  showToast(`✅ Ambulance registered! Your ID: ${id}`, 'success');
  loadRegisteredItems();
}

function getRegisteredHospitals() {
  try { return JSON.parse(localStorage.getItem('lifegrid_hospitals') || '[]'); } catch { return []; }
}
function getRegisteredAmbulances() {
  try { return JSON.parse(localStorage.getItem('lifegrid_ambulances') || '[]'); } catch { return []; }
}

function loadRegisteredItems() {
  const hospitals = getRegisteredHospitals();
  const ambs = getRegisteredAmbulances();
  
  const hList = document.getElementById('registeredHospitals');
  if (hList) {
    hList.innerHTML = hospitals.length === 0 
      ? '<div class="empty-state">No hospitals registered yet</div>'
      : hospitals.map(h => `
          <div class="reg-item">
            <div class="reg-item-icon">🏥</div>
            <div class="reg-item-info">
              <strong>${h.name}</strong>
              <span>${h.district} | ${h.category} | ${h.total_beds} beds</span>
            </div>
            <span class="reg-item-id">${h.id}</span>
          </div>`).join('');
  }

  const aList = document.getElementById('registeredAmbulances');
  if (aList) {
    aList.innerHTML = ambs.length === 0
      ? '<div class="empty-state">No ambulances registered yet</div>'
      : ambs.map(a => `
          <div class="reg-item">
            <div class="reg-item-icon">🚑</div>
            <div class="reg-item-info">
              <strong>${a.name}</strong>
              <span>${a.district} | ${a.type_label} | ${a.license_plate}</span>
            </div>
            <span class="reg-item-id">${a.id}</span>
          </div>`).join('');
  }
}

// ── Init Dropdowns ────────────────────────────────────────────────
function initDistrictDropdowns() {
  // District select on Emergency page — grouped by state using optgroups
  const districtSelect = document.getElementById('districtSelect');
  if (districtSelect) {
    // Build state → districts map from HOSPITAL_DATA
    const stateDistrictMap = {};
    HOSPITAL_DATA.forEach(h => {
      if (!h.district || !h.state) return;
      if (!stateDistrictMap[h.state]) stateDistrictMap[h.state] = new Set();
      stateDistrictMap[h.state].add(h.district);
    });
    // Sort states alphabetically, then districts within each state
    const sortedStates = Object.keys(stateDistrictMap).sort();
    sortedStates.forEach(stateName => {
      const group = document.createElement('optgroup');
      group.label = stateName;
      const sortedDistricts = [...stateDistrictMap[stateName]].sort();
      sortedDistricts.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d; opt.textContent = d;
        group.appendChild(opt);
      });
      districtSelect.appendChild(group);
    });
  }

  // Registration forms — use states
  const regSelects = [
    document.getElementById('regDistrictSelect'),
    document.getElementById('aRegDistSelect'),
  ];
  regSelects.forEach(sel => {
    if (!sel) return;
    INDIA_STATES.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s; opt.textContent = s;
      sel.appendChild(opt);
    });
  });
}

// ── Emergency Type Selector ───────────────────────────────────────
function setEmergencyType(typeKey) {
  // Toggle off if clicking the same type
  if (state.emergencyType === typeKey) {
    state.emergencyType = null;
    document.querySelectorAll('.emergency-type-pill').forEach(p => p.classList.remove('active'));
    showToast('Emergency type cleared', 'warning');
    return;
  }
  state.emergencyType = typeKey;
  // Update pill UI
  document.querySelectorAll('.emergency-type-pill').forEach(p => p.classList.remove('active'));
  const activePill = document.getElementById('etPill-' + typeKey);
  if (activePill) activePill.classList.add('active');
  // Pre-fill textarea if it's empty or was pre-filled
  const config = EMERGENCY_TYPE_MAP[typeKey];
  if (config && config.sampleText) {
    const textarea = document.getElementById('emergencyInput');
    if (!textarea.value.trim() || textarea.dataset.prefilled === 'true') {
      textarea.value = config.sampleText;
      textarea.dataset.prefilled = 'true';
    }
  }
  if (config) showToast(`✅ Emergency type: ${config.label}`, 'success');
}

function onDistrictChange() {
  const dist = document.getElementById('districtSelect').value;
  if (dist) {
    const h = HOSPITAL_DATA.find(x => x.district === dist);
    if (h) { state.userLat = h.lat; state.userLng = h.lng; }
  }
}

function initSpecCheckboxes() {
  const container = document.getElementById('specCheckboxes');
  if (!container) return;
  container.innerHTML = SPECIALTIES_LIST.map(s => `
    <label class="spec-cb">
      <input type="checkbox" data-type="spec" value="${s}" name="spec_${s.replace(/\s/g,'_')}"> ${s}
    </label>`).join('');
}

function initFacilityCheckboxes() {
  const container = document.getElementById('facCheckboxes');
  if (!container) return;
  container.innerHTML = FACILITIES_LIST.map(f => `
    <label class="spec-cb">
      <input type="checkbox" data-type="fac" value="${f}" name="fac_${f.replace(/\s/g,'_')}"> ${f}
    </label>`).join('');
}

function initAmbulanceEquipChecklist() {
  const container = document.getElementById('ambulanceEquipChecklist');
  if (!container) return;
  container.innerHTML = AMBULANCE_EQUIPMENT_LIST.map(e => `
    <label class="spec-cb">
      <input type="checkbox" value="${e}" name="equip_${e.replace(/\s|\//g,'_')}"> ${e}
    </label>`).join('');
}

// ── Toast ─────────────────────────────────────────────────────────
let toastTimeout;
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.add('hidden'), 3500);
}

// ── Unregister Service Worker to prevent caching ─────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (let r of registrations) r.unregister();
  });
}

// ── Expose helpers globally for inline event handlers ─────────────
window.currentAmbulanceId = null;
window.state = state;

// ═══════════════════════════════════════════════════════════════
// LIFEGRID PAN-INDIA COMMAND CENTER & ROAD ROUTING ENGINE
// ═══════════════════════════════════════════════════════════════

const OSRM = 'https://router.project-osrm.org/route/v1/driving';

const REGION_COORDS = {
  all:       { center: [22.9734, 78.6569], zoom: 5,  defaultLat: 30.3398, defaultLng: 78.0644 },
  dehradun:  { center: [30.3398, 78.0644], zoom: 13, defaultLat: 30.3398, defaultLng: 78.0644 },
  mumbai:    { center: [19.0760, 72.8777], zoom: 12, defaultLat: 19.0760, defaultLng: 72.8777 },
  delhi:     { center: [28.6139, 77.2090], zoom: 12, defaultLat: 28.6139, defaultLng: 77.2090 },
  bengaluru: { center: [12.9716, 77.5946], zoom: 12, defaultLat: 12.9716, defaultLng: 77.5946 },
  chennai:   { center: [13.0827, 80.2707], zoom: 12, defaultLat: 13.0827, defaultLng: 80.2707 },
  hyderabad: { center: [17.3850, 78.4867], zoom: 12, defaultLat: 17.3850, defaultLng: 78.4867 },
  kolkata:   { center: [22.5726, 88.3639], zoom: 12, defaultLat: 22.5726, defaultLng: 88.3639 },
  ahmedabad: { center: [23.0225, 72.5714], zoom: 12, defaultLat: 23.0225, defaultLng: 72.5714 },
  jaipur:    { center: [26.9124, 75.7873], zoom: 12, defaultLat: 26.9124, defaultLng: 75.7873 },
  lucknow:   { center: [26.8467, 80.9462], zoom: 12, defaultLat: 26.8467, defaultLng: 80.9462 },
  bhubaneswar:{ center: [20.2961, 85.8245], zoom: 12, defaultLat: 20.2961, defaultLng: 85.8245 },
  chandigarh:{ center: [30.7333, 76.7794], zoom: 12, defaultLat: 30.7333, defaultLng: 76.7794 },
  guwahati:  { center: [26.1445, 91.7362], zoom: 12, defaultLat: 26.1445, defaultLng: 91.7362 }
};

let ccMap = null;
let ccIncidentMarker = null;
let ccAmbulanceMarkers = {};
let ccHospitalMarkers = {};
let ccRouteLines = [];
let ccMovingAmbMarker = null;
let ccEtaCountdownTimer = null;
let ccAnimationHandle = null;
let ccIncidentCount = 0;
const ccIncidentLog = [];

function makeMapIcon(color, html) {
  return L.divIcon({
    className: '',
    html: `<div class="map-marker map-marker--${color}">${html}</div>`,
    iconSize: [36, 36], iconAnchor: [18, 18], popupAnchor: [0, -20]
  });
}

const CC_ICONS = {
  ambFree: makeMapIcon('green', '<i class="fa-solid fa-truck-medical"></i>'),
  ambBusy: makeMapIcon('red', '<i class="fa-solid fa-truck-medical"></i>'),
  ambMoving: makeMapIcon('orange', '<i class="fa-solid fa-truck-medical"></i>'),
  hospTrauma: makeMapIcon('blue', '<i class="fa-solid fa-hospital"></i>'),
  hospGen: makeMapIcon('teal', '<i class="fa-solid fa-hospital"></i>'),
  incident: makeMapIcon('orange', '<i class="fa-solid fa-circle-exclamation"></i>'),
};

function initCommandCenter() {
  const mapContainer = document.getElementById('map');
  if (!mapContainer || ccMap) return;

  // 1. Clock
  setInterval(() => {
    const el = document.getElementById('liveClock');
    if (el) el.textContent = new Date().toLocaleTimeString('en-IN', { hour12: false });
  }, 1000);

  // 2. Leaflet Map setup
  ccMap = L.map('map', { center: [30.3398, 78.0644], zoom: 13, zoomControl: false });
  L.control.zoom({ position: 'bottomright' }).addTo(ccMap);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors', maxZoom: 19
  }).addTo(ccMap);

  setTimeout(() => { if (ccMap) ccMap.invalidateSize(); }, 300);

  // Map Click -> Set Pin
  ccMap.on('click', e => {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    const inpLat = document.getElementById('inpLat');
    const inpLon = document.getElementById('inpLon');
    if (inpLat) inpLat.value = lat.toFixed(5);
    if (inpLon) inpLon.value = lng.toFixed(5);
    placeIncidentPin(lat, lng, 'Incident Location');
    const hint = document.getElementById('mapHint');
    if (hint) hint.style.opacity = '0';
  });

  // Re-load markers whenever user pans or zooms to show hospitals in that area
  ccMap.on('moveend', () => {
    loadCommandCenterMarkers();
  });

  // Initial Pin
  placeIncidentPin(30.3398, 78.0644, 'Dehradun Center');

  // 3. Load Markers
  loadCommandCenterMarkers();

  // 4. Severity Initial Preview
  updateSeverityPreview();

  // 5. Update header stat chips
  updateCommandCenterStats();

  console.log('LIFEGRID: Command Center Map initialized successfully');
}

function updateCommandCenterStats() {
  const avail = AMBULANCE_DATA.filter(a => a.status === 'available').length;
  const allHospitals = [...HOSPITAL_DATA, ...getRegisteredHospitals()];
  const actEl = document.getElementById('statActiveVal');
  const ambEl = document.getElementById('statAmbVal');
  const hospEl = document.getElementById('statHospVal');
  const totEl = document.getElementById('statTotalVal');
  if (actEl) actEl.textContent = ccIncidentLog.filter(i => i.status !== 'closed').length;
  if (ambEl) ambEl.textContent = avail;
  if (hospEl) hospEl.textContent = allHospitals.length.toLocaleString();
  if (totEl) totEl.textContent = ccIncidentCount;
}

function loadCommandCenterMarkers() {
  if (!ccMap) return;

  // Clear existing
  Object.values(ccHospitalMarkers).forEach(m => ccMap.removeLayer(m));
  Object.values(ccAmbulanceMarkers).forEach(m => ccMap.removeLayer(m));
  ccHospitalMarkers = {};
  ccAmbulanceMarkers = {};

  const bounds = ccMap.getBounds().pad(0.35);
  const center = ccMap.getCenter();
  const zoom = ccMap.getZoom();

  // 1. Ambulances: Plot in-bounds or closest
  AMBULANCE_DATA.forEach(a => {
    if (!a.lat || !a.lng) return;
    if (bounds.contains([a.lat, a.lng]) || zoom <= 6) {
      const icon = a.status === 'available' ? CC_ICONS.ambFree : CC_ICONS.ambBusy;
      const marker = L.marker([a.lat, a.lng], { icon })
        .addTo(ccMap)
        .bindPopup(`
          <div class="map-popup">
            <div class="popup-title">🚑 ${a.code || a.name}</div>
            <div class="popup-row">${a.status === 'available' ? '<span class="popup-badge popup-badge--green">Available</span>' : '<span class="popup-badge popup-badge--red">Busy</span>'} · ${a.city || a.district || ''}</div>
            <div class="popup-row">Type: <b>${a.type_label || a.type}</b> · Cap: <b>${a.capacity}</b></div>
            <div class="popup-row">Ventilator: <b>${(a.equipment||[]).includes('Ventilator') || a.has_ventilator ? '✅ Yes' : 'Standard'}</b></div>
          </div>
        `);
      ccAmbulanceMarkers[a.id || a.code] = marker;
    }
  });

  // 2. Hospitals: Prioritize nearby / visible hospitals
  const allHospitals = [...HOSPITAL_DATA, ...getRegisteredHospitals()];

  let hospitalsToPlot = allHospitals.filter(h => h.lat && h.lng && bounds.contains([h.lat, h.lng]));

  if (hospitalsToPlot.length < 5) {
    // Sort by proximity to map center
    hospitalsToPlot = allHospitals
      .filter(h => h.lat && h.lng)
      .map(h => ({ h, d: (h.lat - center.lat)**2 + (h.lng - center.lng)**2 }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 150)
      .map(x => x.h);
  } else {
    hospitalsToPlot = hospitalsToPlot.slice(0, 250);
  }

  hospitalsToPlot.forEach(h => {
    if (!h.lat || !h.lng) return;
    const isTrauma = (h.specialties || []).includes('Orthopedic Surgeon') || (h.specialties || []).includes('trauma') || h.has_emergency || (h.name||'').toLowerCase().includes('trauma');
    const icon = isTrauma ? CC_ICONS.hospTrauma : CC_ICONS.hospGen;
    const marker = L.marker([h.lat, h.lng], { icon })
      .addTo(ccMap)
      .bindPopup(`
        <div class="map-popup">
          <div class="popup-title">${h.name}</div>
          <div class="popup-row">${h.has_icu ? '<span class="popup-badge popup-badge--green">ICU Available</span>' : '<span class="popup-badge popup-badge--red">No ICU</span>'} ${isTrauma ? '<span class="popup-badge popup-badge--blue">Trauma Center</span>' : ''}</div>
          <div class="popup-row">Beds Free: <b>${h.available_beds || h.er_beds_free || 12}</b> · ${h.district || h.state || ''}</div>
          <div class="popup-row"><i>${(h.specialties||[]).slice(0,3).join(', ') || 'General Emergency'}</i></div>
        </div>
      `);
    ccHospitalMarkers[h.id || h.name] = marker;
  });

  updateCommandCenterStats();
}

function placeIncidentPin(lat, lon, label) {
  if (!ccMap) return;
  if (ccIncidentMarker) ccMap.removeLayer(ccIncidentMarker);
  ccIncidentMarker = L.marker([lat, lon], { icon: CC_ICONS.incident })
    .addTo(ccMap)
    .bindPopup(`<b>${label}</b><br>${lat.toFixed(4)}, ${lon.toFixed(4)}`);
}

function onRegionChange() {
  const regKey = document.getElementById('regionSelect')?.value || 'dehradun';
  const reg = REGION_COORDS[regKey] || REGION_COORDS.dehradun;
  if (ccMap) {
    ccMap.flyTo(reg.center, reg.zoom, { duration: 1.0 });
    document.getElementById('inpLat').value = reg.defaultLat.toFixed(5);
    document.getElementById('inpLon').value = reg.defaultLng.toFixed(5);
    placeIncidentPin(reg.defaultLat, reg.defaultLng, `Incident (${regKey.toUpperCase()})`);
    setTimeout(loadCommandCenterMarkers, 600);
  }
}

function setDehradunCenter() {
  document.getElementById('regionSelect').value = 'dehradun';
  onRegionChange();
}

function onTypeToggle(cb) {
  const label = cb.closest('.type-btn');
  if (label) {
    if (cb.checked) label.classList.add('type-btn--active');
    else label.classList.remove('type-btn--active');
  }
  updateSeverityPreview();
}

function updateSeverityPreview() {
  const v = parseInt(document.getElementById('inpVictims')?.value) || 1;
  const u = parseInt(document.getElementById('inpUnconscious')?.value) || 0;
  const bl = document.getElementById('chkBleeding')?.checked || false;
  const br = document.getElementById('chkBreathing')?.checked || false;
  const fi = document.getElementById('chkFire')?.checked || false;
  const hz = document.getElementById('chkHazmat')?.checked || false;
  const tr = document.getElementById('chkTrapped')?.checked || false;
  const sp = document.getElementById('chkSpine')?.checked || false;
  const rb = document.getElementById('chkRoad')?.checked || false;
  const un = document.getElementById('chkUnsafe')?.checked || false;
  const ch = document.getElementById('chkChild')?.checked || false;
  const oa = parseInt(document.getElementById('inpOldest')?.value) || null;
  const ya = parseInt(document.getElementById('inpYoungest')?.value) || null;

  const selectedTypes = Array.from(document.querySelectorAll('input[name="accType"]:checked')).map(i => i.value);

  let s = Math.min(v, 3) * 8 + Math.max(0, v - 3) * 4;
  s += Math.min(u, 2) * 25;
  if (bl) s += 20;
  if (br) s += 18;
  if (fi) s += 15;
  if (hz) s += 15;
  if (tr) s += 12;
  if (sp) s += 10;
  if (rb) s += 5;
  if (un) s += 8;
  if ((oa && oa >= 65) || (ya && ya <= 5) || ch) s += 10;

  const weights = { cardiac: 22, burn: 20, neuro: 18, breathing: 18, road: 14, industrial: 14, drowning: 15, poisoning: 14, electrical: 12, pediatric: 12, fall: 10, other: 5 };
  if (selectedTypes.length) {
    const scores = selectedTypes.map(t => weights[t] || 5).sort((a, b) => b - a);
    s += scores[0] + scores.slice(1).reduce((acc, curr) => acc + curr * 0.4, 0);
  } else {
    s += 5;
  }

  s = Math.min(100, Math.round(s));
  const scoreEl = document.getElementById('sevScore');
  const wordEl = document.getElementById('sevWord');
  const barEl = document.getElementById('sevBar');

  if (scoreEl) scoreEl.textContent = s;
  let word = s >= 75 ? 'CRITICAL' : s >= 50 ? 'HIGH' : s >= 25 ? 'MODERATE' : 'LOW';
  let cls = s >= 75 ? 'sev-critical' : s >= 50 ? 'sev-high' : s >= 25 ? 'sev-moderate' : 'sev-low';
  if (wordEl) {
    wordEl.textContent = word;
    wordEl.className = `sev-word ${cls}`;
  }
  if (barEl) {
    barEl.style.width = s + '%';
    barEl.style.backgroundColor = s >= 75 ? '#ef4444' : s >= 50 ? '#f97316' : s >= 25 ? '#eab308' : '#22c55e';
  }
}

// ═══════════════════════════════════════════════════════════════
// OSRM ROAD ROUTING
// ═══════════════════════════════════════════════════════════════

async function getOSRMRoute(from, to) {
  try {
    const url = `${OSRM}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes?.length) return null;
    const route = data.routes[0];
    const coords = route.geometry.coordinates.map(([lng, lat]) => L.latLng(lat, lng));
    return {
      coords,
      distKm: Math.round(route.distance / 100) / 10,
      durationMin: Math.round(route.duration / 60 * 10) / 10
    };
  } catch (_) {
    // Fallback: Straight-line haversine
    const d = haversineDistance(from.lat, from.lng, to.lat, to.lng);
    const durationMin = Math.round((d / 40) * 60);
    return {
      coords: [from, to],
      distKm: Math.round(d * 10) / 10,
      durationMin: Math.max(2, durationMin)
    };
  }
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ═══════════════════════════════════════════════════════════════
// SMART DISPATCH TRIGGER & ROAD ANIMATION
// ═══════════════════════════════════════════════════════════════

async function triggerSmartDispatch() {
  const lat = parseFloat(document.getElementById('inpLat')?.value) || 30.3398;
  const lon = parseFloat(document.getElementById('inpLon')?.value) || 78.0644;
  const victims = parseInt(document.getElementById('inpVictims')?.value) || 1;
  const unconscious = parseInt(document.getElementById('inpUnconscious')?.value) || 0;
  const selectedTypes = Array.from(document.querySelectorAll('input[name="accType"]:checked')).map(i => i.value);
  const primaryType = selectedTypes[0] || 'road';

  const hasBleeding = document.getElementById('chkBleeding')?.checked || false;
  const hasBreathing = document.getElementById('chkBreathing')?.checked || false;
  const requiresVentilator = unconscious > 0 || hasBreathing || selectedTypes.includes('cardiac');
  const isBurnOrTrauma = selectedTypes.includes('burn') || selectedTypes.includes('fall') || selectedTypes.includes('road');

  const dispatchBtn = document.getElementById('btnDispatch');
  if (dispatchBtn) {
    dispatchBtn.disabled = true;
    dispatchBtn.classList.add('btn-dispatch--busy');
    document.getElementById('btnDispatchTitle').textContent = 'Dispatching Unit…';
    document.getElementById('btnDispatchSub').textContent = 'Calculating optimal road routes';
  }

  // 1. Match Ambulance
  const availableAmbs = AMBULANCE_DATA.filter(a => a.status === 'available');
  if (!availableAmbs.length) {
    showToast('All ambulances currently dispatched! Resetting demo...', 'warning');
    resetDemo();
  }

  // Candidate scoring
  let bestAmb = null;
  let bestAmbScore = -9999;
  availableAmbs.forEach(a => {
    let score = 100;
    const dist = haversineDistance(lat, lon, a.lat, a.lng);
    score -= dist * 2.5; // distance penalty
    if (a.capacity >= victims) score += 20;
    if (requiresVentilator && ((a.equipment||[]).includes('Ventilator') || a.has_ventilator)) score += 35;
    if (isBurnOrTrauma && (a.type === 'ALS' || a.type === 'TRAUMA')) score += 25;
    if (score > bestAmbScore) {
      bestAmbScore = score;
      bestAmb = a;
    }
  });

  if (!bestAmb) bestAmb = availableAmbs[0] || AMBULANCE_DATA[0];

  // 2. Match Hospital
  const allHospitals = [...HOSPITAL_DATA, ...getRegisteredHospitals()];
  let bestHosp = null;
  let bestHospScore = -9999;
  allHospitals.forEach(h => {
    if (!h.lat || !h.lng) return;
    let score = 100;
    const dist = haversineDistance(lat, lon, h.lat, h.lng);
    score -= dist * 2;
    if (unconscious > 0 && h.has_icu) score += 40;
    if (isBurnOrTrauma && (h.has_emergency || (h.specialties||[]).includes('Orthopedic Surgeon'))) score += 30;
    if (selectedTypes.includes('cardiac') && (h.specialties||[]).includes('Cardiologist')) score += 35;
    if (selectedTypes.includes('burn') && (h.specialties||[]).includes('Plastic Surgeon')) score += 35;
    if (score > bestHospScore) {
      bestHospScore = score;
      bestHosp = h;
    }
  });

  if (!bestHosp) bestHosp = allHospitals[0];

  // Increment incident count
  ccIncidentCount++;
  const incidentId = ccIncidentCount;

  // Render Right Panel
  showCommandCenterDispatchResult({
    incidentId,
    ambulance: bestAmb,
    hospital: bestHosp,
    primaryType,
    victims,
    requiresVentilator,
    isBurnOrTrauma,
    lat, lon
  });

  // Execute Road Animation
  await executeRoadRoutingAnimation(bestAmb, lat, lon, bestHosp, incidentId);

  if (dispatchBtn) {
    dispatchBtn.disabled = false;
    dispatchBtn.classList.remove('btn-dispatch--busy');
    document.getElementById('btnDispatchTitle').textContent = 'Dispatch Ambulance';
    document.getElementById('btnDispatchSub').textContent = 'Find best available unit via road';
  }
}

function showCommandCenterDispatchResult(info) {
  document.getElementById('resultPlaceholder')?.classList.add('hidden');
  const rc = document.getElementById('resultContent');
  if (rc) rc.classList.remove('hidden');

  const s = parseInt(document.getElementById('sevScore')?.textContent) || 45;
  const word = document.getElementById('sevWord')?.textContent || 'MODERATE';
  const badge = document.getElementById('sevBadge');
  if (badge) {
    badge.textContent = word;
    badge.className = `sev-badge sev-${word.toLowerCase()}`;
  }
  const bigScore = document.getElementById('sevScoreBig');
  if (bigScore) bigScore.textContent = s;

  // Ambulance card
  const amb = info.ambulance;
  document.getElementById('ambCode').textContent = `${amb.code || amb.name} (${amb.city || amb.district || 'All-India'})`;
  document.getElementById('ambEta').textContent = 'Calculating…';
  document.getElementById('ambEquip').textContent = `⚙️ ${amb.type_label || amb.type}`;
  document.getElementById('ambVent').textContent = info.requiresVentilator ? '🫁 Ventilator Assigned' : '🚑 Standard Kit';
  document.getElementById('ambDist').textContent = '📍 Routing…';

  // Why this unit chips
  const whyChips = document.getElementById('whyChips');
  if (whyChips) {
    const chips = [
      '<span class="why-chip"><i class="fa-solid fa-check"></i>Available Unit</span>',
      `<span class="why-chip"><i class="fa-solid fa-check"></i>${amb.type} Class Medical Kit</span>`,
      '<span class="why-chip"><i class="fa-solid fa-check"></i>Nearest Eligible ETA</span>'
    ];
    if (info.requiresVentilator) chips.push('<span class="why-chip"><i class="fa-solid fa-check"></i>Ventilator Onboard</span>');
    if (info.isBurnOrTrauma) chips.push('<span class="why-chip"><i class="fa-solid fa-check"></i>Burn / Trauma Ready</span>');
    whyChips.innerHTML = chips.join('');
  }

  // Hospital card
  const hosp = info.hospital;
  document.getElementById('hospName').textContent = hosp.name;
  document.getElementById('hospEta').textContent = 'Calculating…';
  document.getElementById('hospTrauma').textContent = hosp.has_emergency ? '🏥 Trauma Center' : 'General ER';
  document.getElementById('hospIcu').textContent = hosp.has_icu ? '🛏 Assigned: ICU Bed' : '🛏 Assigned: ER Bed';
  document.getElementById('hospDist').textContent = '📍 Routing…';
  const specEl = document.getElementById('hospSpec');
  if (specEl) {
    specEl.innerHTML = (hosp.specialties || ['Emergency Medicine', 'Critical Care'])
      .slice(0, 3).map(sp => `<span class="spec-tag">${sp}</span>`).join('');
  }

  // Decision list
  const decAmb = document.getElementById('decisionAmb');
  if (decAmb) {
    decAmb.innerHTML = `
      <div class="decision-item"><i class="fa-solid fa-check"></i>Unit ${amb.code || amb.name} ready for immediate dispatch</div>
      <div class="decision-item"><i class="fa-solid fa-check"></i>Meets ${info.primaryType.toUpperCase()} clinical capability</div>
    `;
  }
  const decHosp = document.getElementById('decisionHosp');
  if (decHosp) {
    decHosp.innerHTML = `
      <div class="decision-item"><i class="fa-solid fa-check"></i>${hosp.name} has emergency facilities available</div>
      <div class="decision-item"><i class="fa-solid fa-check"></i>Fastest road access from scene</div>
    `;
  }

  // Timeline
  const now = new Date();
  const fmt = d => d.toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit' });
  ['tl1', 'tl2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('tl-done');
    const tel = document.getElementById(id + 'Time');
    if (tel) tel.textContent = fmt(now);
  });
  ['tl3', 'tl4'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('tl-done');
    const tel = document.getElementById(id + 'Time');
    if (tel) tel.textContent = '–';
  });

  const incIdEl = document.getElementById('incidentId');
  if (incIdEl) incIdEl.textContent = '#' + info.incidentId;
}

// ═══════════════════════════════════════════════════════════════
// ROAD ROUTING & ANIMATION EXECUTION
// ═══════════════════════════════════════════════════════════════

async function executeRoadRoutingAnimation(amb, incLat, incLon, hosp, incidentId) {
  if (!ccMap) return;

  // Clear previous lines
  ccRouteLines.forEach(l => ccMap.removeLayer(l));
  ccRouteLines = [];
  if (ccAnimationHandle) { cancelAnimationFrame(ccAnimationHandle); ccAnimationHandle = null; }
  if (ccMovingAmbMarker) { ccMap.removeLayer(ccMovingAmbMarker); ccMovingAmbMarker = null; }
  stopEtaCountdown();

  const ambPos = L.latLng(amb.lat, amb.lng);
  const incPos = L.latLng(incLat, incLon);
  const hospPos = L.latLng(hosp.lat, hosp.lng);

  // Hide static marker
  const staticMarker = ccAmbulanceMarkers[amb.id];
  if (staticMarker) staticMarker.setOpacity(0.2);

  // Fetch real road routes
  const [route1, route2] = await Promise.all([
    getOSRMRoute(ambPos, incPos),
    getOSRMRoute(incPos, hospPos)
  ]);

  const p1Dist = route1 ? route1.distKm : haversineDistance(amb.lat, amb.lng, incLat, incLon).toFixed(1);
  const p1Eta = route1 ? route1.durationMin : Math.round(p1Dist * 1.5);
  const p2Dist = route2 ? route2.distKm : haversineDistance(incLat, incLon, hosp.lat, hosp.lng).toFixed(1);
  const p2Eta = route2 ? route2.durationMin : Math.round(p2Dist * 1.5);

  document.getElementById('ambEta').textContent = p1Eta;
  document.getElementById('ambDist').textContent = `🛣️ ${p1Dist} km (road)`;
  document.getElementById('ambRoadInfo').textContent = `🟢 Clear Road · ${p1Eta} min`;

  document.getElementById('hospEta').textContent = Math.round(p2Eta + 5);
  document.getElementById('hospDist').textContent = `🛣️ ${p2Dist} km (road)`;
  document.getElementById('hospRoadInfo').textContent = `🟢 Priority Route · ${p2Eta} min`;

  // Draw routes
  const waypoints1 = route1?.coords || [ambPos, incPos];
  const waypoints2 = route2?.coords || [incPos, hospPos];

  const plan1 = L.polyline(waypoints1, { color: '#f59e0b', weight: 3, dashArray: '6 8', opacity: 0.4 }).addTo(ccMap);
  const plan2 = L.polyline(waypoints2, { color: '#22d3ee', weight: 3, dashArray: '6 8', opacity: 0.4 }).addTo(ccMap);
  const trail1 = L.polyline([], { color: '#f59e0b', weight: 5, opacity: 0.95 }).addTo(ccMap);
  const trail2 = L.polyline([], { color: '#22d3ee', weight: 5, opacity: 0.95 }).addTo(ccMap);
  ccRouteLines.push(plan1, plan2, trail1, trail2);

  // Fit bounds to entire emergency path
  ccMap.fitBounds(L.latLngBounds([...waypoints1, ...waypoints2]).pad(0.25));

  // Moving Ambulance Marker
  ccMovingAmbMarker = L.marker([ambPos.lat, ambPos.lng], { icon: CC_ICONS.ambMoving, zIndexOffset: 1000 })
    .addTo(ccMap)
    .bindTooltip('🚑 En Route to Scene…', { permanent: true, direction: 'top', offset: [0, -10] });

  // Phase 1 duration: 10 seconds for visual delight
  const p1Ms = 9000;
  const p2Ms = 9000;

  startEtaCountdown(Math.round(p1Eta * 60 / 10), 'En Route to Scene', `🛣️ ${p1Dist} km road to patient`);

  // Add Incident Log entry
  addIncidentLogEntry({
    id: incidentId,
    time: new Date().toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit' }),
    location: `${incLat.toFixed(3)}, ${incLon.toFixed(3)}`,
    type: document.querySelector('input[name="accType"]:checked')?.value || 'Emergency',
    victims: document.getElementById('inpVictims')?.value || 1,
    severity: document.getElementById('sevWord')?.textContent || 'HIGH',
    ambulance: amb.code || amb.name,
    hospital: hosp.name,
    eta: `${p1Eta} min`,
    status: 'dispatched'
  });

  animateAlongPath(ccMovingAmbMarker, trail1, waypoints1, p1Ms, () => {
    // Reached patient
    if (ccMovingAmbMarker) {
      ccMovingAmbMarker.setTooltipContent('🚑 Loading Patient…');
      ccMovingAmbMarker.setIcon(CC_ICONS.ambBusy);
    }
    const tl3 = document.getElementById('tl3');
    if (tl3) tl3.classList.add('tl-done');
    const tl3t = document.getElementById('tl3Time');
    if (tl3t) tl3t.textContent = new Date().toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit' });
    showToast(`🚑 Unit ${amb.code || amb.name} arrived at scene! Patient secured.`, 'success');
    updateIncidentStatus(incidentId, 'en_route');

    // 2-second pause while securing patient
    setTimeout(() => {
      if (ccMovingAmbMarker) {
        ccMovingAmbMarker.setTooltipContent('🚑 Transporting to Hospital…');
        ccMovingAmbMarker.setIcon(CC_ICONS.ambMoving);
      }
      startEtaCountdown(Math.round(p2Eta * 60 / 10), 'En Route to Hospital', `🛣️ ${p2Dist} km road to hospital`);

      // Phase 2: Scene -> Hospital
      animateAlongPath(ccMovingAmbMarker, trail2, waypoints2, p2Ms, () => {
        // Reached hospital
        if (ccMovingAmbMarker) {
          ccMovingAmbMarker.setTooltipContent(`🏥 Delivered to ${hosp.name}`);
          ccMovingAmbMarker.setIcon(CC_ICONS.ambFree);
        }
        const tl4 = document.getElementById('tl4');
        if (tl4) tl4.classList.add('tl-done');
        const tl4t = document.getElementById('tl4Time');
        if (tl4t) tl4t.textContent = new Date().toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit' });
        showToast(`🏥 Patient safely delivered to ${hosp.name}!`, 'success');
        stopEtaCountdown();
        updateIncidentStatus(incidentId, 'arrived');

        // Free ambulance after 2s
        setTimeout(() => {
          if (ccMovingAmbMarker) { ccMap.removeLayer(ccMovingAmbMarker); ccMovingAmbMarker = null; }
          if (staticMarker) staticMarker.setOpacity(1);
          updateIncidentStatus(incidentId, 'closed');
          showToast(`Emergency #${incidentId} closed. Ambulance freed!`, 'success');
          updateCommandCenterStats();
        }, 2500);
      });
    }, 2000);
  });
}

function animateAlongPath(marker, trailLine, waypoints, totalMs, onDone) {
  if (!waypoints || waypoints.length < 2) { if (onDone) onDone(); return; }
  const segs = [];
  let totalDist = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const d = waypoints[i].distanceTo(waypoints[i + 1]);
    segs.push({ from: waypoints[i], to: waypoints[i + 1], dist: d });
    totalDist += d;
  }
  if (totalDist === 0) { marker.setLatLng(waypoints[waypoints.length - 1]); if (onDone) onDone(); return; }
  segs.forEach(s => s.dur = (s.dist / totalDist) * totalMs);

  let si = 0, t0 = null;
  function step(ts) {
    if (t0 === null) t0 = ts;
    const seg = segs[si];
    const t = Math.min((ts - t0) / (seg.dur || 1), 1);
    const te = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    const lat = seg.from.lat + (seg.to.lat - seg.from.lat) * te;
    const lng = seg.from.lng + (seg.to.lng - seg.from.lng) * te;
    const curPt = L.latLng(lat, lng);
    marker.setLatLng(curPt);

    const donePts = waypoints.slice(0, si + 1);
    donePts.push(curPt);
    trailLine.setLatLngs(donePts);

    if (t >= 1) {
      si++;
      t0 = ts;
      if (si >= segs.length) {
        trailLine.setLatLngs(waypoints);
        marker.setLatLng(waypoints[waypoints.length - 1]);
        if (onDone) onDone();
        return;
      }
    }
    ccAnimationHandle = requestAnimationFrame(step);
  }
  ccAnimationHandle = requestAnimationFrame(step);
}

function startEtaCountdown(totalSeconds, phaseLabel, roadInfoText) {
  stopEtaCountdown();
  const counterEl = document.getElementById('etaCounter');
  const phaseEl = document.getElementById('etaPhaseLabel');
  const timeEl = document.getElementById('etaTimeDisplay');
  const infoEl = document.getElementById('etaRoadInfo');

  if (phaseEl) phaseEl.textContent = phaseLabel || 'En Route';
  if (infoEl) infoEl.textContent = roadInfoText || '';
  if (counterEl) counterEl.classList.remove('hidden');

  let remaining = Math.max(0, Math.round(totalSeconds));
  const updateDisplay = () => {
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    if (timeEl) timeEl.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  updateDisplay();
  ccEtaCountdownTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      if (timeEl) timeEl.textContent = '0:00';
      clearInterval(ccEtaCountdownTimer);
      ccEtaCountdownTimer = null;
    } else {
      updateDisplay();
    }
  }, 1000);
}

function stopEtaCountdown() {
  if (ccEtaCountdownTimer) {
    clearInterval(ccEtaCountdownTimer);
    ccEtaCountdownTimer = null;
  }
  const counterEl = document.getElementById('etaCounter');
  if (counterEl) counterEl.classList.add('hidden');
}

function addIncidentLogEntry(entry) {
  ccIncidentLog.unshift(entry);
  renderIncidentLog();
  updateCommandCenterStats();
}

function updateIncidentStatus(id, newStatus) {
  const inc = ccIncidentLog.find(i => i.id === id);
  if (inc) {
    inc.status = newStatus;
    renderIncidentLog();
  }
  updateCommandCenterStats();
}

function renderIncidentLog() {
  const tbody = document.getElementById('logBody');
  if (!tbody) return;
  if (!ccIncidentLog.length) {
    tbody.innerHTML = '<tr><td colspan="11" class="empty-log">No incidents reported yet. Select emergency type, click map and dispatch.</td></tr>';
    return;
  }
  tbody.innerHTML = ccIncidentLog.map(i => {
    const sevCls = i.severity === 'CRITICAL' ? 'sev-badge--critical' : i.severity === 'HIGH' ? 'sev-badge--high' : i.severity === 'MODERATE' ? 'sev-badge--moderate' : 'sev-badge--low';
    const statusCls = `status-${i.status}`;
    return `
      <tr>
        <td><b>#${i.id}</b></td>
        <td>${i.time}</td>
        <td class="coord-cell">${i.location}</td>
        <td><span class="chip-sm chip-type">${i.type}</span></td>
        <td>${i.victims} <span class="victims-sub">patients</span></td>
        <td><span class="sev-badge-sm ${sevCls}">${i.severity}</span></td>
        <td><span class="chip-sm chip-amb">🚑 ${i.ambulance}</span></td>
        <td class="hosp-cell" title="${i.hospital}"><span class="chip-sm chip-hosp">🏥 ${i.hospital}</span></td>
        <td><b>${i.eta}</b></td>
        <td><span class="status-badge ${statusCls}">${i.status.replace('_', ' ')}</span></td>
        <td class="action-cell">
          ${i.status !== 'closed' ? `<button type="button" class="btn-action" onclick="updateIncidentStatus(${i.id}, 'closed')">Close</button>` : '<span class="closed-text">Done</span>'}
        </td>
      </tr>
    `;
  }).join('');
}

function resetDemo() {
  AMBULANCE_DATA.forEach(a => a.status = 'available');
  if (ccRouteLines.length && ccMap) {
    ccRouteLines.forEach(l => ccMap.removeLayer(l));
    ccRouteLines = [];
  }
  if (ccMovingAmbMarker && ccMap) {
    ccMap.removeLayer(ccMovingAmbMarker);
    ccMovingAmbMarker = null;
  }
  stopEtaCountdown();
  loadCommandCenterMarkers();
  ccIncidentLog.forEach(i => i.status = 'closed');
  renderIncidentLog();
  updateCommandCenterStats();
  document.getElementById('resultContent')?.classList.add('hidden');
  document.getElementById('resultPlaceholder')?.classList.remove('hidden');
  showToast('Demo reset! All 32 ambulances are free across India.', 'success');
}

window.initCommandCenter = initCommandCenter;
window.onRegionChange = onRegionChange;
window.setDehradunCenter = setDehradunCenter;
window.onTypeToggle = onTypeToggle;
window.updateSeverityPreview = updateSeverityPreview;
window.triggerSmartDispatch = triggerSmartDispatch;
window.renderIncidentLog = renderIncidentLog;
window.updateIncidentStatus = updateIncidentStatus;
window.resetDemo = resetDemo;
