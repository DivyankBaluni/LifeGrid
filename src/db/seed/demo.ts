import { db } from '../../shared/db/index.js';
import { reportEmergency } from '../../modules/intake/index.js';
import { createReferral, scheduleFollowUp } from '../../modules/referral/index.js';
import { parseInboundSMS } from '../../modules/offline-gateway/index.js';
import { seedUttarakhandToDb } from '../../modules/pan-india/uttarakhand.js';

export function seedDemoScenario() {
  console.log('--- Initializing Clean LIFEGRID Demo State ---');

  // Clear existing records for clean demo execution
  db.exec(`
    DELETE FROM follow_up_schedules;
    DELETE FROM referrals;
    DELETE FROM hospital_alerts;
    DELETE FROM incidents;
    DELETE FROM triage_results;
    DELETE FROM specialists;
    DELETE FROM ambulances;
    DELETE FROM hospitals;
    DELETE FROM patients;
    DELETE FROM users;
    DELETE FROM audit_logs;
  `);

  // 0. Seed Comprehensive Uttarakhand Regional Hospitals & Fleet Dataset
  seedUttarakhandToDb(db);

  const now = new Date().toISOString();

  // 1. Seed Users (Roles from ARCHITECTURE §8)
  const insertUser = db.prepare(`
    INSERT INTO users (id, username, password_hash, full_name, role, facility_id, language_pref, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run('usr-operator-01', 'operator', 'demo_hash', 'Dr. Ramesh Sharma (Control Center Lead)', 'control_center_operator', null, 'en', now);
  insertUser.run('usr-asha-01', 'sunita_asha', 'demo_hash', 'Sunita Devi (Frontline ASHA Worker)', 'health_worker', 'hosp-phc-rampur', 'hi', now);
  insertUser.run('usr-dr-hospital-b', 'dr_anita_b', 'demo_hash', 'Dr. Anita Joshi (Cardiologist, District Hospital)', 'hospital_staff', 'hosp-b-district', 'en', now);

  // 2. Seed Facilities: Specifically Hospital A and Hospital B from ARCHITECTURE §5
  const insertHospital = db.prepare(`
    INSERT INTO hospitals (
      id, name, tier, capability_tags, bed_capacity, beds_available,
      diagnostics_available, medicines_available, location, contact_number,
      accessibility_status, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Hospital A: 2 km from village, NO cardiac specialist or cath lab, 1/20 beds
  insertHospital.run(
    'hosp-a-local',
    'Community Health Centre (Hospital A)',
    'rural_hospital',
    JSON.stringify(['general_medicine', 'minor_trauma', 'maternity']),
    20,
    1,
    JSON.stringify(['ecg', 'blood_test', 'xray']),
    JSON.stringify(['paracetamol', 'basic_antibiotics', 'saline']),
    JSON.stringify({ latitude: 19.8820, longitude: 75.3510, address: 'Nearby Rural Taluka Road, 2km' }),
    '+91-240-2334001',
    'specialist_unavailable', // Amber/Yellow
    now
  );

  // Hospital B: 9 km from village, HAS Cardiac Cath Lab + Cardiac Specialist on site, 12/40 beds
  insertHospital.run(
    'hosp-b-district',
    'District Super-Specialty Medical Centre (Hospital B)',
    'district_hospital',
    JSON.stringify(['cardiac', 'trauma', 'icu', 'neonatal', 'surgery']),
    40,
    12,
    JSON.stringify(['ct_scan', 'cath_lab', 'ecg', 'ultrasound', 'blood_bank']),
    JSON.stringify(['streptokinase', 'antivenom', 'heparin', 'insulin', 'antibiotics']),
    JSON.stringify({ latitude: 19.9450, longitude: 75.4120, address: 'District Highway Junction, 9km' }),
    '+91-240-2339999',
    'phc_functioning', // Green
    now
  );

  // Facility C: Primary Health Centre (PHC) Rampur (for referral chain demo)
  insertHospital.run(
    'hosp-phc-rampur',
    'Primary Health Centre (PHC Rampur)',
    'phc',
    JSON.stringify(['primary_care', 'immunization', 'basic_maternity']),
    6,
    4,
    JSON.stringify(['rapid_malaria_kit', 'glucometer', 'hemoglobinometer']),
    JSON.stringify(['paracetamol', 'iron_folic_acid', 'oral_rehydration']),
    JSON.stringify({ latitude: 19.8520, longitude: 75.3120, address: 'Village Rampur Main Gate' }),
    '+91-240-2331122',
    'phc_functioning', // Green
    now
  );

  // Hospital D: Dehradun Regional Hospital (Uttarakhand Demo)
  insertHospital.run(
    'hosp-d-dehradun',
    'Dehradun Regional Hospital',
    'district_hospital',
    JSON.stringify(['trauma', 'icu', 'cardiac', 'respiratory']),
    50,
    15,
    JSON.stringify(['ct_scan', 'blood_bank', 'xray']),
    JSON.stringify(['antibiotics', 'antivenom', 'saline']),
    JSON.stringify({ latitude: 30.3398, longitude: 78.0644, address: 'Dehradun City Center' }),
    '+91-135-2334455',
    'phc_functioning',
    now
  );

  // Hospital E: Doiwala Rural Clinic (Uttarakhand Demo)
  insertHospital.run(
    'hosp-e-doiwala',
    'Doiwala Rural Clinic',
    'rural_hospital',
    JSON.stringify(['general_medicine', 'minor_trauma']),
    10,
    3,
    JSON.stringify(['blood_test']),
    JSON.stringify(['paracetamol', 'first_aid']),
    JSON.stringify({ latitude: 30.1600, longitude: 78.1200, address: 'Doiwala Village' }),
    '+91-135-2223333',
    'specialist_unavailable',
    now
  );

  // 3. Specialists on site
  const insertSpecialist = db.prepare(`
    INSERT INTO specialists (id, hospital_id, name, specialty, available)
    VALUES (?, ?, ?, ?, ?)
  `);
  // Hospital A has General Physician, NO Cardiologist
  insertSpecialist.run('spec-a-1', 'hosp-a-local', 'Dr. V. Kulkarni', 'general_medicine', 1);

  // Hospital B has Cardiologist + Trauma Surgeon
  insertSpecialist.run('spec-b-1', 'hosp-b-district', 'Dr. Anita Joshi', 'cardiology', 1);
  insertSpecialist.run('spec-b-2', 'hosp-b-district', 'Dr. Sandeep Rathod', 'trauma_surgery', 1);

  // Dehradun Hospital has Trauma Surgeon
  insertSpecialist.run('spec-d-1', 'hosp-d-dehradun', 'Dr. Rajesh Kumar', 'trauma_surgery', 1);

  // 4. Seed Ambulances
  const insertAmbulance = db.prepare(`
    INSERT INTO ambulances (id, vehicle_number, capability_tags, current_location, status, assigned_incident_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertAmbulance.run(
    'amb-108-als',
    'MH-20-AX-1088 (ALS Rapid Response)',
    JSON.stringify(['ALS', 'cardiac', 'trauma']),
    JSON.stringify({ latitude: 19.8790, longitude: 75.3480, address: 'Ambulance Stand, Village Outpost' }),
    'available',
    null,
    now
  );

  insertAmbulance.run(
    'amb-102-bls',
    'MH-20-BY-1022 (Basic Transport)',
    JSON.stringify(['BLS', 'neonatal']),
    JSON.stringify({ latitude: 19.9100, longitude: 75.3800, address: 'Taluka Depo' }),
    'available',
    null,
    now
  );

  insertAmbulance.run(
    'amb-uk-als',
    'UK-07-AL-5000 (Hilly Terrain ALS)',
    JSON.stringify(['ALS', 'trauma']),
    JSON.stringify({ latitude: 30.3300, longitude: 78.0700, address: 'Dehradun Ambulance Depot' }),
    'available',
    null,
    now
  );

  // 5. Seed Patients
  const insertPatient = db.prepare(`
    INSERT INTO patients (id, name, age_band, high_risk_flags, known_conditions, language_pref, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertPatient.run(
    'pat-maternal-01',
    'Kavita Patil',
    'adult',
    JSON.stringify(['maternal']),
    JSON.stringify(['High blood pressure', 'Gestational diabetes']),
    'hi',
    now
  );

  insertPatient.run(
    'pat-cardiac-01',
    'Bhagwanrao Deshmukh',
    'geriatric',
    JSON.stringify(['chronic']),
    JSON.stringify(['Hypertension', 'History of angina']),
    'mr',
    now
  );

  // 6. SCENARIO 1: Hospital A/B Worked Example (ARCHITECTURE §5)
  console.log('Running Scenario 1: P1 Cardiac Emergency (Hospital A vs Hospital B)...');
  const emergencyReport = reportEmergency({
    reported_by: 'usr-asha-01',
    channel: 'app',
    location: {
      latitude: 19.8762,
      longitude: 75.3433,
      address: 'Rampur Farm Settlement, Sector 4',
    },
    raw_symptoms: 'Patient collapsed with severe crushing chest pain, radiating left arm pain, sweating profusely',
    checklist_symptoms: ['crushing chest pain', 'sweating chest pain', 'cardiac'],
    patient_id: 'pat-cardiac-01',
    age_band: 'geriatric',
    known_conditions: ['Hypertension'],
  });

  console.log(`- Triage Result: Priority ${emergencyReport.triage.priority}, Score ${emergencyReport.triage.score}`);
  console.log(`- Hospital Match Winner: "${emergencyReport.hospital_match?.selected_hospital?.name}"`);
  console.log(`- Reason: ${emergencyReport.hospital_match?.trace?.reasoning}`);

  // 7. SCENARIO 2: Referral Continuity Chain (PHC -> Rural Hospital -> District Hospital)
  console.log('Running Scenario 2: 3-Tier Referral Continuity with Carried-forward Context...');
  const referral1 = createReferral({
    patient_id: 'pat-maternal-01',
    from_facility_id: 'hosp-phc-rampur',
    to_facility_id: 'hosp-b-district',
    reason: 'High-risk 3rd trimester pregnancy with pre-eclampsia and elevated BP (160/105)',
    context_payload: {
      prior_symptoms: 'Headache, blurry vision, bilateral leg edema',
      triage_summary: 'AI-suggested priority P2: High-risk pregnancy requiring tertiary obstetric monitoring',
      initial_findings: 'BP 160/105 mmHg, Proteinuria 2+, fetal heart rate 142 bpm',
      vital_signs: { bp: '160/105', pulse: 88, spo2: 98, temp: 37 },
      interventions_given: ['Labetalol 100mg orally administered at PHC', 'Left lateral tilt positioned'],
      referral_urgency: 'P2',
      notes: 'Carried forward from PHC Rampur to District Super-Specialty. Receiving facility briefed.',
    },
    actor_user_id: 'usr-asha-01',
  });

  // Schedule high-risk follow-up reminder
  const followUp = scheduleFollowUp({
    patient_id: 'pat-maternal-01',
    due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    reason: 'Post-stabilization Doppler ultrasound and maternal biophysical profile',
    facility_id: 'hosp-b-district',
  });

  // 8. SCENARIO 3: Low-Connectivity SMS Scenario
  console.log('Running Scenario 3: Low-Connectivity SMS Reporting Fallback...');
  const smsReport = parseInboundSMS({
    from: '+919876543210',
    body: 'EMRG severe bleeding head injury LOC:19.8650,75.3350',
  });
  console.log(`- SMS Inbound Normalized Incident ID: ${smsReport.normalized_incident.id}`);
  console.log(`- SMS Outbound Reply: "${smsReport.outbound_reply_sms}"`);

  console.log('--- Seeding Completed Successfully ---');

  return {
    scenario1_cardiac: emergencyReport,
    scenario2_referral: referral1,
    scenario2_followup: followUp,
    scenario3_sms: smsReport,
  };
}

// Allow direct CLI execution: `node dist/db/seed/demo.js` or `tsx src/db/seed/demo.ts`
if (process.argv[1]?.endsWith('demo.ts') || process.argv[1]?.endsWith('demo.js')) {
  seedDemoScenario();
}
