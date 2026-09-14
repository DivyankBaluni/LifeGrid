import fs from "fs";
import path from "path";

let PAN_INDIA_HOSPITALS = [];
let PAN_INDIA_AMBULANCES = [];
let isLoaded = false;

export function loadPanIndiaDataset() {
  if (isLoaded) {
    return {
      hospitalsCount: PAN_INDIA_HOSPITALS.length,
      ambulancesCount: PAN_INDIA_AMBULANCES.length,
    };
  }

  try {
    // 1. Load Ambulances
    const ambPath = path.resolve(process.cwd(), "data/ambulances.js");
    if (fs.existsSync(ambPath)) {
      const ambContent = fs.readFileSync(ambPath, "utf-8");
      // Extract array from JS constant
      const jsonStart = ambContent.indexOf("[");
      const jsonEnd = ambContent.lastIndexOf("]");
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const jsonStr = ambContent.substring(jsonStart, jsonEnd + 1);
        try {
          PAN_INDIA_AMBULANCES = JSON.parse(jsonStr);
        } catch {
          // Fallback for JS object literal with unquoted keys
          PAN_INDIA_AMBULANCES = new Function(`return ${jsonStr}`)();
        }
      }
    }
  } catch (err) {
    console.warn("Could not parse ambulances.js:", err);
  }

  try {
    // 2. Load Hospitals from JSON
    const hospPath = path.resolve(process.cwd(), "data/hospitals.json");
    if (fs.existsSync(hospPath)) {
      const hospContent = fs.readFileSync(hospPath, "utf-8");
      PAN_INDIA_HOSPITALS = JSON.parse(hospContent);
    }
  } catch (err) {
    console.warn("Could not parse hospitals.json:", err);
  }

  isLoaded = true;
  console.log(
    `[LIFEGRID Registry] Indexed ${PAN_INDIA_HOSPITALS.length} Pan-India hospitals and ${PAN_INDIA_AMBULANCES.length} ambulance units.`,
  );

  return {
    hospitalsCount: PAN_INDIA_HOSPITALS.length,
    ambulancesCount: PAN_INDIA_AMBULANCES.length,
  };
}

export function searchPanIndiaHospitals(query = {}) {
  if (!isLoaded) loadPanIndiaDataset();

  let results = PAN_INDIA_HOSPITALS;

  if (query.state && query.state !== "all") {
    const qState = query.state.toLowerCase();
    results = results.filter((h) =>
      (h.state || "").toLowerCase().includes(qState),
    );
  }

  if (query.district) {
    const qDist = query.district.toLowerCase();
    results = results.filter((h) =>
      (h.district || "").toLowerCase().includes(qDist),
    );
  }

  if (query.has_icu) {
    results = results.filter((h) => h.has_icu);
  }

  if (query.has_emergency) {
    results = results.filter((h) => h.has_emergency);
  }

  if (query.specialty) {
    const qSpec = query.specialty.toLowerCase();
    results = results.filter((h) =>
      (h.specialties || []).some((s) => s.toLowerCase().includes(qSpec)),
    );
  }

  if (query.search) {
    const s = query.search.toLowerCase();
    results = results.filter(
      (h) =>
        (h.name || "").toLowerCase().includes(s) ||
        (h.district || "").toLowerCase().includes(s) ||
        (h.address || "").toLowerCase().includes(s),
    );
  }

  // If coordinates provided, sort by proximity
  if (query.lat && query.lng) {
    const uLat = query.lat;
    const uLng = query.lng;
    results = [...results].sort((a, b) => {
      const da = (a.lat - uLat) ** 2 + (a.lng - uLng) ** 2;
      const db = (b.lat - uLat) ** 2 + (b.lng - uLng) ** 2;
      return da - db;
    });
  }

  const limit = query.limit || 50;
  return results.slice(0, limit);
}

export function getPanIndiaAmbulances(query) {
  if (!isLoaded) loadPanIndiaDataset();

  let list = PAN_INDIA_AMBULANCES;
  if (query?.type) {
    list = list.filter((a) => a.type === query.type);
  }
  if (query?.district) {
    list = list.filter(
      (a) => (a.district || "").toLowerCase() === query.district.toLowerCase(),
    );
  }
  return list;
}
