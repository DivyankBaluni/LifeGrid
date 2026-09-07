"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
exports.initDatabase = initDatabase;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const DB_PATH = process.env.LIFEGRID_DB_PATH || path_1.default.resolve(process.cwd(), 'lifegrid.db');
// Ensure parent dir exists
const dbDir = path_1.default.dirname(DB_PATH);
if (!fs_1.default.existsSync(dbDir)) {
    fs_1.default.mkdirSync(dbDir, { recursive: true });
}
exports.db = new better_sqlite3_1.default(DB_PATH);
// Enable WAL mode for high concurrency and Foreign Keys
exports.db.pragma('journal_mode = WAL');
exports.db.pragma('foreign_keys = ON');
function initDatabase() {
    exports.db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL,
      facility_id TEXT,
      language_pref TEXT DEFAULT 'en',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      name TEXT,
      age_band TEXT NOT NULL,
      high_risk_flags TEXT NOT NULL, -- JSON array
      known_conditions TEXT NOT NULL, -- JSON array
      language_pref TEXT DEFAULT 'en',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hospitals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tier TEXT NOT NULL,
      capability_tags TEXT NOT NULL, -- JSON array
      bed_capacity INTEGER NOT NULL,
      beds_available INTEGER NOT NULL,
      diagnostics_available TEXT NOT NULL, -- JSON array
      medicines_available TEXT NOT NULL, -- JSON array
      location TEXT NOT NULL, -- JSON GeoPoint
      contact_number TEXT NOT NULL,
      accessibility_status TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS specialists (
      id TEXT PRIMARY KEY,
      hospital_id TEXT NOT NULL,
      name TEXT NOT NULL,
      specialty TEXT NOT NULL,
      available INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ambulances (
      id TEXT PRIMARY KEY,
      vehicle_number TEXT NOT NULL,
      capability_tags TEXT NOT NULL, -- JSON array
      current_location TEXT NOT NULL, -- JSON GeoPoint
      status TEXT NOT NULL,
      assigned_incident_id TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS triage_results (
      id TEXT PRIMARY KEY,
      incident_id TEXT,
      rule_set_version TEXT NOT NULL,
      inputs_used TEXT NOT NULL, -- JSON array
      inputs_missing TEXT NOT NULL, -- JSON array
      signals_fired TEXT NOT NULL, -- JSON array
      score REAL NOT NULL,
      priority TEXT NOT NULL,
      confidence_flags TEXT NOT NULL, -- JSON object
      human_reviewed INTEGER NOT NULL DEFAULT 0,
      override TEXT, -- JSON object
      plain_language_summary TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY,
      reported_by TEXT,
      channel TEXT NOT NULL,
      location TEXT NOT NULL, -- JSON GeoPoint
      raw_symptoms TEXT NOT NULL,
      patient_id TEXT,
      triage_result_id TEXT,
      status TEXT NOT NULL,
      matched_ambulance_id TEXT,
      matched_hospital_id TEXT,
      signal_priority_requested INTEGER DEFAULT 0,
      drone_dispatch_logged INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL,
      FOREIGN KEY (triage_result_id) REFERENCES triage_results(id) ON DELETE SET NULL,
      FOREIGN KEY (matched_ambulance_id) REFERENCES ambulances(id) ON DELETE SET NULL,
      FOREIGN KEY (matched_hospital_id) REFERENCES hospitals(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS hospital_alerts (
      id TEXT PRIMARY KEY,
      incident_id TEXT NOT NULL,
      hospital_id TEXT NOT NULL,
      eta_minutes REAL NOT NULL,
      status TEXT NOT NULL,
      readiness_checklist TEXT NOT NULL, -- JSON object
      created_at TEXT NOT NULL,
      acknowledged_at TEXT,
      FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
      FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS referrals (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      from_facility_id TEXT NOT NULL,
      to_facility_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      triage_result_id TEXT,
      status TEXT NOT NULL,
      context_payload TEXT NOT NULL, -- JSON object
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (from_facility_id) REFERENCES hospitals(id),
      FOREIGN KEY (to_facility_id) REFERENCES hospitals(id),
      FOREIGN KEY (triage_result_id) REFERENCES triage_results(id)
    );

    CREATE TABLE IF NOT EXISTS follow_up_schedules (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      due_date TEXT NOT NULL,
      reason TEXT NOT NULL,
      facility_id TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (facility_id) REFERENCES hospitals(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      trace_payload TEXT NOT NULL, -- JSON object
      timestamp TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id);
    CREATE INDEX IF NOT EXISTS idx_referrals_patient ON referrals(patient_id);
  `);
}
// Auto-initialize DB on module import
initDatabase();
