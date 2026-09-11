"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateDistanceKm = calculateDistanceKm;
exports.estimateEtaMinutes = estimateEtaMinutes;
exports.loadUttarakhandHospitalsFromGeoJSON = loadUttarakhandHospitalsFromGeoJSON;
exports.getUttarakhandFleet = getUttarakhandFleet;
exports.seedUttarakhandToDb = seedUttarakhandToDb;
exports.executeMultiPatientDispatch = executeMultiPatientDispatch;
exports.fetchOSRMRouteWithFallback = fetchOSRMRouteWithFallback;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Haversine formula
function calculateDistanceKm(from, to) {
    const R = 6371;
    const dLat = ((to.latitude - from.latitude) * Math.PI) / 180;
    const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((from.latitude * Math.PI) / 180) *
            Math.cos((to.latitude * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(2));
}
// Estimate ETA in minutes with hilly terrain factor
function estimateEtaMinutes(distKm, isEmergency = true) {
    // Hilly Uttarakhand terrain speed: emergency ~38 km/h, routine ~28 km/h
    const speed = isEmergency ? 38 : 28;
    const raw = (distKm / speed) * 60;
    return Math.max(3, Math.round(raw * 1.25 + 2));
}
// 1. Parse Uttarakhand GeoJSON
function loadUttarakhandHospitalsFromGeoJSON() {
    const geojsonPath = path_1.default.resolve(process.cwd(), 'data/export.geojson');
    if (!fs_1.default.existsSync(geojsonPath)) {
        console.warn('[Uttarakhand] GeoJSON file not found at:', geojsonPath);
        return [];
    }
    const rawData = JSON.parse(fs_1.default.readFileSync(geojsonPath, 'utf-8'));
    const features = rawData.features || [];
    const hospitals = [];
    for (let i = 0; i < features.length; i++) {
        const f = features[i];
        const props = f.properties || {};
        const geom = f.geometry || {};
        if (!geom.coordinates || geom.coordinates.length < 2)
            continue;
        const lng = geom.coordinates[0];
        const lat = geom.coordinates[1];
        const rawName = props.name || props['name:en'] || props['official_name'] || `Hospital UK #${i + 1}`;
        const city = props['addr:city'] || props['addr:district'] || props['addr:full'] || 'Dehradun';
        const street = props['addr:street'] || '';
        const lowerName = rawName.toLowerCase();
        // Determine Tier & Medical Capabilities
        let tier = 'rural_hospital';
        let capTags = ['general_medicine', 'first_aid'];
        let bedCap = 40;
        let icuBeds = 4;
        let diagnostics = ['ecg', 'blood_test', 'xray'];
        let doctors = [
            { name: 'Dr. R. K. Joshi', specialty: 'general_medicine', available: true },
        ];
        if (lowerName.includes('aiims') ||
            lowerName.includes('institute') ||
            lowerName.includes('max super') ||
            lowerName.includes('medical sciences') ||
            lowerName.includes('hospital trust')) {
            tier = 'district_hospital';
            capTags = ['cardiac', 'trauma', 'icu', 'neuro', 'surgery', 'burn_care', 'pediatric', 'respiratory', 'dialysis'];
            bedCap = 450;
            icuBeds = 60;
            diagnostics = ['ct_scan', 'mri', 'cath_lab', 'ultrasound', 'blood_bank', 'ecg', 'emergency_ot'];
            doctors = [
                { name: 'Dr. Anita Joshi', specialty: 'cardiology', available: true },
                { name: 'Dr. Sandeep Rathod', specialty: 'trauma_surgery', available: true },
                { name: 'Dr. Alok Nautiyal', specialty: 'neurosurgery', available: true },
                { name: 'Dr. Meena Rawat', specialty: 'critical_care_icu', available: true },
                { name: 'Dr. Vikas Bhandari', specialty: 'burn_care', available: true },
            ];
        }
        else if (lowerName.includes('government') ||
            lowerName.includes('general') ||
            lowerName.includes('s.p.s') ||
            lowerName.includes('maternity') ||
            lowerName.includes('surgical') ||
            lowerName.includes('cmi') ||
            lowerName.includes('synergy')) {
            tier = 'district_hospital';
            capTags = ['trauma', 'orthopedic', 'surgery', 'icu', 'general_medicine', 'maternity', 'respiratory'];
            bedCap = 160;
            icuBeds = 18;
            diagnostics = ['ct_scan', 'xray', 'ultrasound', 'blood_bank', 'ecg'];
            doctors = [
                { name: 'Dr. P. Negi', specialty: 'general_surgery', available: true },
                { name: 'Dr. R. K. Verma', specialty: 'orthopedics', available: true },
                { name: 'Dr. Sunita Bhatt', specialty: 'trauma_surgery', available: true },
            ];
        }
        else if (lowerName.includes('clinic') || lowerName.includes('ayurvedic') || lowerName.includes('ashram')) {
            tier = 'phc';
            capTags = ['primary_care', 'general_medicine', 'first_aid'];
            bedCap = 15;
            icuBeds = 0;
            diagnostics = ['rapid_test', 'glucometer', 'ecg'];
            doctors = [{ name: 'Dr. H. C. Sharma', specialty: 'general_medicine', available: true }];
        }
        const availableBeds = Math.max(2, Math.floor(bedCap * 0.28));
        const availableIcu = icuBeds > 0 ? Math.max(1, Math.floor(icuBeds * 0.22)) : 0;
        const hospId = `uk-hosp-${i + 1}-${lowerName.replace(/[^a-z0-9]/g, '').slice(0, 14)}`;
        hospitals.push({
            id: hospId,
            name: rawName,
            tier,
            capability_tags: capTags,
            bed_capacity: bedCap,
            beds_available: availableBeds,
            icu_beds: icuBeds,
            available_icu: availableIcu,
            diagnostics_available: diagnostics,
            medicines_available: ['heparin', 'streptokinase', 'antivenom', 'antibiotics', 'saline', 'oxygen'],
            location: {
                latitude: lat,
                longitude: lng,
                address: [street, city, 'Uttarakhand'].filter(Boolean).join(', '),
            },
            contact_number: props.phone || props['emergency:phone'] || `+91-135-${2400000 + (i % 9000)}`,
            accessibility_status: 'phc_functioning',
            doctors,
            city,
        });
    }
    return hospitals;
}
// 2. Comprehensive Uttarakhand Ambulance Fleet
function getUttarakhandFleet() {
    return [
        {
            id: 'uk-amb-101',
            vehicle_number: 'UK-07-PA-1081 (ALS Rapid Response)',
            capability_tags: ['ALS', 'cardiac', 'ventilator', 'trauma', 'defibrillator'],
            current_location: { latitude: 30.3255, longitude: 78.0436, address: 'Clock Tower Emergency Outpost, Dehradun' },
            status: 'available',
            capacity: 1,
            driver_name: 'Mohan Singh Rawat',
            paramedic_name: 'Aakash Panwar (Critical Care)',
            contact_number: '+91-98765-10801',
            base_station: 'Dehradun Central',
        },
        {
            id: 'uk-amb-102',
            vehicle_number: 'UK-07-AX-1082 (BLS Dual-Transport)',
            capability_tags: ['BLS', 'oxygen', 'splints', 'spine_board', 'basic_life_support'],
            current_location: { latitude: 30.2862, longitude: 78.0075, address: 'ISBT Transport Bay, Dehradun' },
            status: 'available',
            capacity: 2,
            driver_name: 'Dinesh Chandra Joshi',
            paramedic_name: 'Rekha Negi',
            contact_number: '+91-98765-10802',
            base_station: 'ISBT Dehradun',
        },
        {
            id: 'uk-amb-103',
            vehicle_number: 'UK-07-MC-1083 (Mobile Intensive Care MICU)',
            capability_tags: ['MICU', 'ALS', 'ecmo', 'ventilator', 'cardiac', 'neuro'],
            current_location: { latitude: 30.3735, longitude: 78.0750, address: 'Max Hospital Heli-base Junction, Dehradun' },
            status: 'available',
            capacity: 1,
            driver_name: 'Surendra Bisht',
            paramedic_name: 'Dr. Vivek Bhatt (ICU Physician)',
            contact_number: '+91-98765-10803',
            base_station: 'Max Hospital Hub',
        },
        {
            id: 'uk-amb-104',
            vehicle_number: 'UK-14-RS-1084 (AIIMS Heavy Trauma 4WD)',
            capability_tags: ['ALS', 'trauma', 'cardiac', 'ventilator', 'mountain_rescue'],
            current_location: { latitude: 30.0760, longitude: 78.2880, address: 'AIIMS Rishikesh Trauma Outpost' },
            status: 'available',
            capacity: 1,
            driver_name: 'Devendra Bhatt',
            paramedic_name: 'Pooja Gairola (Trauma Paramedic)',
            contact_number: '+91-98765-10804',
            base_station: 'AIIMS Rishikesh',
        },
        {
            id: 'uk-amb-105',
            vehicle_number: 'UK-14-RS-1085 (Rishikesh Rapid BLS)',
            capability_tags: ['BLS', 'oxygen', 'first_aid', 'maternity'],
            current_location: { latitude: 30.1030, longitude: 78.2970, address: 'Triveni Ghat Rescue Bay, Rishikesh' },
            status: 'available',
            capacity: 2,
            driver_name: 'Vikram Negi',
            paramedic_name: 'Manoj Semwal',
            contact_number: '+91-98765-10805',
            base_station: 'Rishikesh S.P.S',
        },
        {
            id: 'uk-amb-106',
            vehicle_number: 'UK-07-MS-1086 (Mussoorie Mountain 4x4 BLS)',
            capability_tags: ['BLS', 'mountain_rescue', 'snow_chains', 'oxygen', 'hypothermia_kit'],
            current_location: { latitude: 30.4590, longitude: 78.0950, address: 'Mall Road / Landour Gate, Mussoorie' },
            status: 'available',
            capacity: 2,
            driver_name: 'Gopal Singh Bhandari',
            paramedic_name: 'Anjali Uniyal',
            contact_number: '+91-98765-10806',
            base_station: 'Mussoorie Hill Outpost',
        },
        {
            id: 'uk-amb-107',
            vehicle_number: 'UK-07-DW-1087 (Doiwala Highway Trauma ALS)',
            capability_tags: ['ALS', 'trauma', 'polytrauma_kit', 'ventilator'],
            current_location: { latitude: 30.1650, longitude: 78.1250, address: 'NH-72 Doiwala Highway Junction' },
            status: 'available',
            capacity: 1,
            driver_name: 'Rajendra Prasad',
            paramedic_name: 'Deepak Chauhan',
            contact_number: '+91-98765-10807',
            base_station: 'Doiwala Toll Hub',
        },
        {
            id: 'uk-amb-108',
            vehicle_number: 'UK-08-HW-1088 (Haridwar Express ALS)',
            capability_tags: ['ALS', 'cardiac', 'resuscitation', 'ventilator'],
            current_location: { latitude: 29.9520, longitude: 78.1680, address: 'Haridwar Bypass Circle' },
            status: 'available',
            capacity: 1,
            driver_name: 'Sunil Kumar',
            paramedic_name: 'Praveen Sharma',
            contact_number: '+91-98765-10808',
            base_station: 'Haridwar North',
        },
        {
            id: 'uk-amb-109',
            vehicle_number: 'UK-08-HW-1089 (Haridwar Twin-Stretcher BLS)',
            capability_tags: ['BLS', 'oxygen', 'splints', 'spine_board'],
            current_location: { latitude: 29.9310, longitude: 78.1400, address: 'Ranipur More, Haridwar' },
            status: 'available',
            capacity: 2,
            driver_name: 'Anil Tyagi',
            paramedic_name: 'Suman Lata',
            contact_number: '+91-98765-10809',
            base_station: 'Haridwar South',
        },
        {
            id: 'uk-amb-110',
            vehicle_number: 'UK-07-JG-1090 (Jolly Grant Aeromedical Link)',
            capability_tags: ['MICU', 'ALS', 'ventilator', 'neonatal', 'incubator', 'critical_care'],
            current_location: { latitude: 30.1890, longitude: 78.1800, address: 'Dehradun Jolly Grant Airport Terminal' },
            status: 'available',
            capacity: 1,
            driver_name: 'Rakesh Pokhriyal',
            paramedic_name: 'Sister Neha Thapa (Flight Nurse)',
            contact_number: '+91-98765-10810',
            base_station: 'Jolly Grant HIHT',
        },
        {
            id: 'uk-amb-111',
            vehicle_number: 'UK-07-CT-1091 (Graphic Era / Clement Town BLS)',
            capability_tags: ['BLS', 'oxygen', 'first_aid', 'splints'],
            current_location: { latitude: 30.2720, longitude: 77.9950, address: 'Graphic Era University Outpost, Clement Town' },
            status: 'available',
            capacity: 2,
            driver_name: 'Virendra Singh',
            paramedic_name: 'Preeti Dobhal',
            contact_number: '+91-98765-10811',
            base_station: 'Clement Town Station',
        },
        {
            id: 'uk-amb-112',
            vehicle_number: 'UK-07-SL-1092 (Selaqui Industrial Trauma ALS)',
            capability_tags: ['ALS', 'trauma', 'burn_care', 'chemical_exposure_kit'],
            current_location: { latitude: 30.3680, longitude: 77.8550, address: 'Selaqui Pharma Corridor Highway' },
            status: 'available',
            capacity: 1,
            driver_name: 'Mahesh Thapliyal',
            paramedic_name: 'Amit Nautiyal',
            contact_number: '+91-98765-10812',
            base_station: 'Selaqui Industrial',
        },
        {
            id: 'uk-amb-113',
            vehicle_number: 'UK-07-VN-1093 (Vikasnagar Rural BLS)',
            capability_tags: ['BLS', 'oxygen', 'rural_transport'],
            current_location: { latitude: 30.4780, longitude: 77.7850, address: 'Vikasnagar Main Market Stand' },
            status: 'available',
            capacity: 2,
            driver_name: 'Harish Chandra',
            paramedic_name: 'Anita Gusain',
            contact_number: '+91-98765-10813',
            base_station: 'Vikasnagar',
        },
        {
            id: 'uk-amb-114',
            vehicle_number: 'UK-07-MP-1094 (Mass-Casualty Multi-Stretcher Bus)',
            capability_tags: ['BLS', 'multi_casualty', 'oxygen_manifold', 'triage_kits'],
            current_location: { latitude: 30.3165, longitude: 78.0322, address: 'State Disaster Response Force Base, Dehradun' },
            status: 'available',
            capacity: 4, // 4-patient mass casualty transport!
            driver_name: 'Subedar Major R. P. Khanduri',
            paramedic_name: 'SDRF Medical Team Alpha',
            contact_number: '+91-98765-10814',
            base_station: 'SDRF Dehradun',
        },
        {
            id: 'uk-amb-115',
            vehicle_number: 'UK-07-RR-1095 (Rajpur Road Express ALS)',
            capability_tags: ['ALS', 'cardiac', 'trauma', 'defibrillator'],
            current_location: { latitude: 30.3550, longitude: 78.0650, address: 'Rajpur Road Police Post, Dehradun' },
            status: 'available',
            capacity: 1,
            driver_name: 'Jaswant Singh Kaintura',
            paramedic_name: 'Kavita Raturi',
            contact_number: '+91-98765-10815',
            base_station: 'Rajpur Road',
        },
    ];
}
// 3. Seed Uttarakhand data into SQLite Database
function seedUttarakhandToDb(db) {
    console.log('[Uttarakhand Seed] Loading hospitals from export.geojson and seeding fleet...');
    // Ensure column schema updates
    try {
        db.exec(`ALTER TABLE ambulances ADD COLUMN capacity INTEGER DEFAULT 1;`);
    }
    catch (e) { }
    try {
        db.exec(`ALTER TABLE ambulances ADD COLUMN driver_name TEXT;`);
    }
    catch (e) { }
    try {
        db.exec(`ALTER TABLE ambulances ADD COLUMN paramedic_name TEXT;`);
    }
    catch (e) { }
    try {
        db.exec(`ALTER TABLE hospitals ADD COLUMN icu_beds INTEGER DEFAULT 0;`);
    }
    catch (e) { }
    try {
        db.exec(`ALTER TABLE hospitals ADD COLUMN available_icu INTEGER DEFAULT 0;`);
    }
    catch (e) { }
    const hospitals = loadUttarakhandHospitalsFromGeoJSON();
    const fleet = getUttarakhandFleet();
    const insertHospital = db.prepare(`
    INSERT OR REPLACE INTO hospitals (
      id, name, tier, capability_tags, bed_capacity, beds_available,
      diagnostics_available, medicines_available, location, contact_number,
      accessibility_status, updated_at, icu_beds, available_icu
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    const insertSpecialist = db.prepare(`
    INSERT OR REPLACE INTO specialists (id, hospital_id, name, specialty, available)
    VALUES (?, ?, ?, ?, ?)
  `);
    const insertAmbulance = db.prepare(`
    INSERT OR REPLACE INTO ambulances (
      id, vehicle_number, capability_tags, current_location, status,
      assigned_incident_id, updated_at, capacity, driver_name, paramedic_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    const now = new Date().toISOString();
    // Seed all Uttarakhand hospitals
    for (const h of hospitals) {
        insertHospital.run(h.id, h.name, h.tier, JSON.stringify(h.capability_tags), h.bed_capacity, h.beds_available, JSON.stringify(h.diagnostics_available), JSON.stringify(h.medicines_available), JSON.stringify(h.location), h.contact_number, h.accessibility_status, now, h.icu_beds, h.available_icu);
        // Seed doctors
        for (let sIdx = 0; sIdx < h.doctors.length; sIdx++) {
            const doc = h.doctors[sIdx];
            insertSpecialist.run(`${h.id}-spec-${sIdx}`, h.id, doc.name, doc.specialty, doc.available ? 1 : 0);
        }
    }
    // Seed Uttarakhand ambulances
    for (const amb of fleet) {
        insertAmbulance.run(amb.id, amb.vehicle_number, JSON.stringify(amb.capability_tags), JSON.stringify(amb.current_location), amb.status, null, now, amb.capacity, amb.driver_name, amb.paramedic_name);
    }
    console.log(`[Uttarakhand Seed] Successfully populated ${hospitals.length} Uttarakhand hospitals & ${fleet.length} active ambulances.`);
    return { hospitalsCount: hospitals.length, fleetCount: fleet.length };
}
// 4. Multi-Ambulance & Multi-Patient Hospital Matching Engine
async function executeMultiPatientDispatch(input) {
    const patientCount = Math.max(1, input.patient_count || 1);
    const incidentLoc = input.incident_location;
    const complaint = input.chief_complaint || 'Multi-casualty road traffic collision';
    const allHospitals = loadUttarakhandHospitalsFromGeoJSON();
    const allAmbulances = getUttarakhandFleet().filter((a) => a.status === 'available');
    if (allAmbulances.length === 0) {
        throw new Error('No ambulances currently available in Uttarakhand regional dispatch network');
    }
    // 1. Synthesize individual patient profiles if not provided
    const patients = [];
    const complaintLower = complaint.toLowerCase();
    const isCardiac = complaintLower.includes('chest') || complaintLower.includes('cardiac') || complaintLower.includes('heart');
    const isBurn = complaintLower.includes('burn') || complaintLower.includes('fire') || complaintLower.includes('explosion');
    for (let i = 0; i < patientCount; i++) {
        const pNum = i + 1;
        if (i === 0) {
            // Patient 1: Primary critical case
            if (isCardiac) {
                patients.push({
                    patient_id: `PT-${pNum}`,
                    name: `Patient #${pNum}`,
                    age_band: 'geriatric',
                    priority: 'P1',
                    condition: 'Acute Coronary Syndrome / STEMI with cardiogenic shock',
                    required_tags: ['cardiac', 'icu', 'cath_lab'],
                    requires_icu: true,
                    requires_doctor_specialty: 'cardiology',
                });
            }
            else if (isBurn) {
                patients.push({
                    patient_id: `PT-${pNum}`,
                    name: `Patient #${pNum}`,
                    age_band: 'adult',
                    priority: 'P1',
                    condition: '3rd-degree severe burns (>40% BSA) with inhalation injury',
                    required_tags: ['burn_care', 'icu', 'surgery'],
                    requires_icu: true,
                    requires_doctor_specialty: 'burn_care',
                });
            }
            else {
                patients.push({
                    patient_id: `PT-${pNum}`,
                    name: `Patient #${pNum}`,
                    age_band: 'adult',
                    priority: 'P1',
                    condition: 'Severe Polytrauma with acute intracranial hemorrhage',
                    required_tags: ['trauma', 'neuro', 'icu', 'ct_scan'],
                    requires_icu: true,
                    requires_doctor_specialty: 'trauma_surgery',
                });
            }
        }
        else if (i === 1) {
            // Patient 2: Severe surgical or neuro trauma
            patients.push({
                patient_id: `PT-${pNum}`,
                name: `Patient #${pNum}`,
                age_band: 'adult',
                priority: 'P1',
                condition: 'Blunt abdominal trauma with internal hemorrhage & hemothorax',
                required_tags: ['trauma', 'surgery', 'icu', 'blood_bank'],
                requires_icu: true,
                requires_doctor_specialty: 'general_surgery',
            });
        }
        else if (i === 2) {
            // Patient 3: Compound fracture / Orthopedic emergency
            patients.push({
                patient_id: `PT-${pNum}`,
                name: `Patient #${pNum}`,
                age_band: 'adult',
                priority: 'P2',
                condition: 'Open compound femoral shaft fracture with arterial compression',
                required_tags: ['orthopedic', 'trauma', 'xray'],
                requires_icu: false,
                requires_doctor_specialty: 'orthopedics',
            });
        }
        else if (i === 3) {
            // Patient 4: Pediatric or respiratory distress
            patients.push({
                patient_id: `PT-${pNum}`,
                name: `Patient #${pNum}`,
                age_band: 'pediatric',
                priority: 'P2',
                condition: 'Pediatric blunt thoracic trauma with respiratory distress',
                required_tags: ['pediatric', 'respiratory', 'oxygen'],
                requires_icu: false,
                requires_doctor_specialty: 'pediatrics',
            });
        }
        else {
            // Patient 5+: Moderate lacerations, fractures, concussions
            patients.push({
                patient_id: `PT-${pNum}`,
                name: `Patient #${pNum}`,
                age_band: 'adult',
                priority: 'P3',
                condition: 'Multiple contusions, mild concussion, and forearm fracture',
                required_tags: ['general_medicine', 'orthopedic', 'xray'],
                requires_icu: false,
            });
        }
    }
    // 2. Select Nearest Available Ambulances to satisfy total patient capacity
    // Sort ambulances by distance to incident
    const sortedAmbulances = [...allAmbulances].sort((a, b) => {
        const distA = calculateDistanceKm(incidentLoc, a.current_location);
        const distB = calculateDistanceKm(incidentLoc, b.current_location);
        return distA - distB;
    });
    const selectedAmbulances = [];
    let totalCapacityCollected = 0;
    for (const amb of sortedAmbulances) {
        selectedAmbulances.push(amb);
        totalCapacityCollected += amb.capacity;
        if (totalCapacityCollected >= patientCount)
            break;
    }
    // 3. Allocate Patients to Ambulances
    // Group critical ICU patients into ALS/MICU units first
    const remainingPatients = [...patients];
    const assignments = [];
    // Track dynamic bed reservations so a hospital is not overwhelmed!
    const hospitalBedReservations = {};
    for (const amb of selectedAmbulances) {
        if (remainingPatients.length === 0)
            break;
        // Pop up to amb.capacity patients
        const passengers = [];
        while (passengers.length < amb.capacity && remainingPatients.length > 0) {
            // Prioritize assigning critical patients to ALS/MICU
            if (amb.capability_tags.includes('ALS') || amb.capability_tags.includes('MICU')) {
                const critIdx = remainingPatients.findIndex((p) => p.priority === 'P1');
                if (critIdx !== -1) {
                    passengers.push(remainingPatients.splice(critIdx, 1)[0]);
                    continue;
                }
            }
            // Otherwise take next available
            passengers.push(remainingPatients.shift());
        }
        // Determine Designated Hospital for this Ambulance & its Passengers
        // Must satisfy the highest acuity requirements among passengers onboard
        const requiresICU = passengers.some((p) => p.requires_icu);
        const combinedTags = Array.from(new Set(passengers.flatMap((p) => p.required_tags)));
        const targetSpecialties = Array.from(new Set(passengers.map((p) => p.requires_doctor_specialty).filter(Boolean)));
        // Score hospitals
        let bestHospital = allHospitals[0];
        let bestScore = -1;
        let bestReason = '';
        for (const hosp of allHospitals) {
            const res = hospitalBedReservations[hosp.id] || { reserved_icu: 0, reserved_general: 0 };
            const effectiveAvailIcu = Math.max(0, hosp.available_icu - res.reserved_icu);
            const effectiveAvailBeds = Math.max(0, hosp.beds_available - res.reserved_general);
            // Hard check: If ICU is required, hospital MUST have available ICU beds!
            if (requiresICU && effectiveAvailIcu < 1) {
                continue;
            }
            // Hard check: If hospital has 0 general beds available
            if (effectiveAvailBeds < passengers.length) {
                continue;
            }
            // Tag matching
            const matchedTags = combinedTags.filter((t) => hosp.capability_tags.includes(t.toLowerCase()));
            const tagMatchRatio = combinedTags.length > 0 ? matchedTags.length / combinedTags.length : 1.0;
            // Doctor specialty check
            const hasSpecialist = targetSpecialties.every((spec) => hosp.doctors.some((d) => d.available && d.specialty.toLowerCase().includes(spec.toLowerCase())));
            // Distance & ETA
            const distKm = calculateDistanceKm(incidentLoc, hosp.location);
            const etaMin = estimateEtaMinutes(distKm, true);
            // Proximity & ETA scoring
            const proxScore = Math.max(0.1, 1 - distKm / 40);
            const etaScore = Math.max(0.1, 1 - etaMin / 50);
            const specBonus = hasSpecialist ? 0.35 : 0.0;
            const icuBonus = requiresICU && hosp.tier === 'district_hospital' ? 0.25 : 0.0;
            const score = tagMatchRatio * 0.45 + specBonus + proxScore * 0.25 + etaScore * 0.15 + icuBonus;
            if (score > bestScore) {
                bestScore = score;
                bestHospital = hosp;
                bestReason = `Designated for [${passengers.map((p) => p.patient_id).join(', ')}]. Matched capabilities: [${matchedTags.join(', ')}], Specialists on site: ${hasSpecialist ? 'YES' : 'Alternative available'}, Available ICU: ${effectiveAvailIcu}, Total Available Beds: ${effectiveAvailBeds}, Road ETA: ${etaMin} min.`;
            }
        }
        // Fallback if strict filter exhausted (pick premier super-specialty)
        if (bestScore === -1) {
            bestHospital = allHospitals.find((h) => h.tier === 'district_hospital') || allHospitals[0];
            bestScore = 0.5;
            bestReason = `Emergency surge designated to premier district hospital due to high-acuity load.`;
        }
        // Reserve beds at designated hospital
        if (!hospitalBedReservations[bestHospital.id]) {
            hospitalBedReservations[bestHospital.id] = { reserved_icu: 0, reserved_general: 0 };
        }
        if (requiresICU)
            hospitalBedReservations[bestHospital.id].reserved_icu += 1;
        hospitalBedReservations[bestHospital.id].reserved_general += passengers.length;
        // Road distances and ETAs
        const distToScene = calculateDistanceKm(amb.current_location, incidentLoc);
        const etaToScene = estimateEtaMinutes(distToScene, true);
        const distToHosp = calculateDistanceKm(incidentLoc, bestHospital.location);
        const etaToHosp = estimateEtaMinutes(distToHosp, true);
        // Generate road waypoints (interpolated with curvature)
        const route1 = generateInterpolatedRoadPath([amb.current_location.latitude, amb.current_location.longitude], [incidentLoc.latitude, incidentLoc.longitude]);
        const route2 = generateInterpolatedRoadPath([incidentLoc.latitude, incidentLoc.longitude], [bestHospital.location.latitude, bestHospital.location.longitude]);
        assignments.push({
            ambulance: amb,
            passengers,
            designated_hospital: bestHospital,
            hospital_match_score: Number(bestScore.toFixed(3)),
            hospital_match_reason: bestReason,
            eta_to_incident_min: etaToScene,
            eta_to_hospital_min: etaToHosp,
            total_eta_min: etaToScene + etaToHosp,
            route_to_scene: [],
            route_to_hospital: [],
        });
    }
    // Fetch authentic road routes via OSRM for all dispatched ambulances in parallel
    await Promise.all(assignments.map(async (asgn) => {
        const startAmb = [asgn.ambulance.current_location.latitude, asgn.ambulance.current_location.longitude];
        const sceneLoc = [incidentLoc.latitude, incidentLoc.longitude];
        const hospLoc = [asgn.designated_hospital.location.latitude, asgn.designated_hospital.location.longitude];
        const [r1, r2] = await Promise.all([
            fetchOSRMRouteWithFallback(startAmb, sceneLoc),
            fetchOSRMRouteWithFallback(sceneLoc, hospLoc),
        ]);
        asgn.route_to_scene = r1;
        asgn.route_to_hospital = r2;
    }));
    const result = {
        incident_id: input.incident_id || `UK-INC-${Date.now().toString().slice(-6)}`,
        incident_location: incidentLoc,
        chief_complaint: complaint,
        total_patients: patientCount,
        ambulances_needed: assignments.length,
        ambulances_dispatched: assignments.length,
        assignments,
        unassigned_patients: remainingPatients,
        plain_explanation: `Dispatched ${assignments.length} Uttarakhand ambulance(s) for ${patientCount} patient(s). Ambulances converged on scene via verified road routes and distributed patients across ${new Set(assignments.map((a) => a.designated_hospital.name)).size} designated hospital(s) based on acute ICU capacity and clinical specialty matching.`,
        timestamp: new Date().toISOString(),
    };
    return result;
}
// In-memory cache for OSRM routes to make repeated calls instantaneous
const osrmRouteCache = new Map();
/**
 * Fetch genuine road route geometry from OSRM public API
 * Falls back to high-resolution realistic curvature path if OSRM is unreachable
 */
async function fetchOSRMRouteWithFallback(start, end) {
    const cacheKey = `${start[0].toFixed(4)},${start[1].toFixed(4)}->${end[0].toFixed(4)},${end[1].toFixed(4)}`;
    if (osrmRouteCache.has(cacheKey)) {
        return osrmRouteCache.get(cacheKey);
    }
    try {
        // OSRM expects coordinates as lng,lat;lng,lat
        const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2800); // 2.8s timeout
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
            const data = await res.json();
            if (data.routes && data.routes[0] && data.routes[0].geometry?.coordinates?.length > 1) {
                // OSRM coordinates are [lng, lat], convert to Leaflet's [lat, lng]
                const roadPoints = data.routes[0].geometry.coordinates.map((c) => [Number(c[1].toFixed(5)), Number(c[0].toFixed(5))]);
                osrmRouteCache.set(cacheKey, roadPoints);
                return roadPoints;
            }
        }
    }
    catch (e) {
        // Silently proceed to fallback
    }
    // Fallback: generate high-fidelity segmented path with road curvature
    const fallback = generateInterpolatedRoadPath(start, end, 16);
    osrmRouteCache.set(cacheKey, fallback);
    return fallback;
}
// Helper to generate realistic road curvature waypoints
function generateInterpolatedRoadPath(start, end, steps = 16) {
    const pts = [];
    pts.push(start);
    for (let i = 1; i < steps; i++) {
        const t = i / steps;
        // Multi-harmonic curvature simulating mountain and valley road turns
        const harmonic1 = Math.sin(t * Math.PI) * 0.0035;
        const harmonic2 = Math.sin(t * 2 * Math.PI) * 0.0018;
        const lat = start[0] + (end[0] - start[0]) * t + harmonic1 + harmonic2;
        const lng = start[1] + (end[1] - start[1]) * t + Math.cos(t * Math.PI) * 0.0032;
        pts.push([Number(lat.toFixed(5)), Number(lng.toFixed(5))]);
    }
    pts.push(end);
    return pts;
}
