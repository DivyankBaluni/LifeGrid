import csv, json, os, math

# ── State / District Centroids for hospitals without GPS ─────────────
STATE_CENTROIDS = {
    'Maharashtra': (19.7515, 75.7139),
    'Gujarat': (22.2587, 71.1924),
    'Uttar Pradesh': (26.8467, 80.9462),
    'Tamil Nadu': (11.1271, 78.6569),
    'Karnataka': (15.3173, 75.7139),
    'Haryana': (29.0588, 76.0856),
    'Andhra Pradesh': (15.9129, 79.7400),
    'Rajasthan': (27.0238, 74.2179),
    'Punjab': (31.1471, 75.3412),
    'Telangana': (18.1124, 79.0193),
    'West Bengal': (22.9868, 87.8550),
    'Bihar': (25.0961, 85.3131),
    'Madhya Pradesh': (22.9734, 78.6569),
    'Kerala': (10.8505, 76.2711),
    'Odisha': (20.9517, 85.0985),
    'Himachal Pradesh': (31.1048, 77.1734),
    'Jharkhand': (23.6102, 85.2799),
    'Chhattisgarh': (21.2787, 81.8661),
    'Uttarakhand': (30.0668, 79.0193),
    'Assam': (26.2006, 92.9376),
    'Jammu and Kashmir': (33.7782, 76.5762),
    'Mizoram': (23.1645, 92.9376),
    'Goa': (15.2993, 74.1240),
    'Meghalaya': (25.4670, 91.3662),
    'Chandigarh': (30.7333, 76.7794),
    'Puducherry': (11.9416, 79.8083),
    'Tripura': (23.9408, 91.9882),
    'Manipur': (24.6637, 93.9063),
    'Dadra and Nagar Haveli': (20.1809, 73.0169),
    'Nagaland': (26.1584, 94.5624),
    'Arunachal Pradesh': (28.2180, 94.7278),
    'Andaman and Nicobar Islands': (11.7401, 92.6586),
    'Daman and Diu': (20.4283, 72.8397),
    'Sikkim': (27.5330, 88.5122),
    'Lakshadweep': (10.5667, 72.6417),
    'Delhi': (28.6139, 77.2090),
}

# District centroids for better accuracy
DISTRICT_CENTROIDS = {
    'Mumbai': (18.9220, 72.8347),
    'Pune': (18.5204, 73.8567),
    'Nagpur': (21.1458, 79.0882),
    'Nashik': (19.9975, 73.7898),
    'Aurangabad': (19.8762, 75.3433),
    'Thane': (19.2183, 72.9781),
    'Solapur': (17.6599, 75.9064),
    'Kolhapur': (16.7050, 74.2433),
    'Amravati': (20.9374, 77.7796),
    'Dehradun': (30.3165, 78.0322),
    'Haridwar': (29.9457, 78.1642),
    'Nainital': (29.3803, 79.4636),
    'Udham Singh Nagar': (28.9967, 79.5170),
    'Rishikesh': (30.0869, 78.2676),
    'Lucknow': (26.8467, 80.9462),
    'Kanpur': (26.4499, 80.3319),
    'Agra': (27.1767, 78.0081),
    'Varanasi': (25.3176, 82.9739),
    'Chennai': (13.0827, 80.2707),
    'Coimbatore': (11.0168, 76.9558),
    'Bengaluru': (12.9716, 77.5946),
    'Mysuru': (12.2958, 76.6394),
    'Hyderabad': (17.3850, 78.4867),
    'Ahmedabad': (23.0225, 72.5714),
    'Surat': (21.1702, 72.8311),
    'Vadodara': (22.3072, 73.1812),
    'Jaipur': (26.9124, 75.7873),
    'Jodhpur': (26.2389, 73.0243),
    'Kolkata': (22.5726, 88.3639),
    'Patna': (25.5941, 85.1376),
    'Bhopal': (23.2599, 77.4126),
    'Indore': (22.7196, 75.8577),
    'Bhubaneswar': (20.2961, 85.8245),
    'Ranchi': (23.3441, 85.3096),
    'Raipur': (21.2514, 81.6296),
    'Shimla': (31.1048, 77.1734),
    'Chandigarh': (30.7333, 76.7794),
    'Guwahati': (26.1445, 91.7362),
    'Srinagar': (34.0837, 74.7973),
    'Jammu': (32.7266, 74.8570),
    'Panaji': (15.4909, 73.8278),
    'Shillong': (25.5788, 91.8933),
    'Imphal': (24.8170, 93.9368),
    'Aizawl': (23.7307, 92.7173),
    'Agartala': (23.8315, 91.2868),
    'Kohima': (25.6751, 94.1086),
    'Itanagar': (27.1020, 93.6115),
    'Gangtok': (27.3389, 88.6065),
    'Port Blair': (11.6234, 92.7265),
    'Daman': (20.3974, 72.8328),
    'Silvassa': (20.2766, 72.9959),
    'Kavaratti': (10.5669, 72.6420),
    'Puducherry': (11.9416, 79.8083),
}

def has_icu(specialties, facilities):
    text = (specialties + ' ' + facilities).lower()
    return any(kw in text for kw in ['critical care', 'icu', 'intensive care', 'ccu', 'nicu', 'picu', 'high dependency'])

def get_specialties(spec_text, fac_text):
    cats = {
        'Cardiologist': ['cardiology', 'cardiothoracic', 'cardiovascular', 'cardiac'],
        'Neurologist': ['neurology', 'neuro surgery', 'neurosurgery'],
        'Orthopedic Surgeon': ['orthopedic', 'traumatology', 'orthopaedic'],
        'Pediatrician': ['pediatric', 'neonatology', 'paediatric'],
        'Oncologist': ['oncology'],
        'Nephrologist': ['nephrology', 'dialysis', 'kidney care'],
        'Gynecologist': ['gynaecology', 'obstetrics', 'gynecology'],
        'General Surgeon': ['general surgery', 'laparoscopic'],
        'Emergency Physician': ['critical care', 'emergency medicine'],
        'Pulmonologist': ['pulmonology', 'respiratory'],
        'Psychiatrist': ['psychiatry'],
        'Ophthalmologist': ['ophthalmology'],
        'ENT Specialist': ['otorhinolaryngology', 'ent'],
        'Gastroenterologist': ['gastroenterology'],
        'Dermatologist': ['dermatology'],
        'Endocrinologist': ['endocrinology', 'diabetology'],
        'Urologist': ['urology'],
        'Plastic Surgeon': ['plastic surgery', 'cosmetic surgery'],
        'Vascular Surgeon': ['vascular surgery'],
    }
    t = (spec_text + ' ' + fac_text).lower()
    return [cat for cat, kws in cats.items() if any(kw in t for kw in kws)]

def jitter(lat, lng, scale=0.05):
    """Add small random offset for hospitals at same centroid."""
    import random
    return (
        lat + (random.random() - 0.5) * scale,
        lng + (random.random() - 0.5) * scale,
    )

hospitals = []
sr_counter = 1

# ────────────────────────────────────────────────────────────────────
# 1. Process main CSV — ALL 30,273 rows
# ────────────────────────────────────────────────────────────────────
print("Processing CSV...")
import random
random.seed(42)

with open('hospital_directory.csv', 'r', encoding='utf-8', errors='replace') as f:
    reader = csv.DictReader(f)
    for row in reader:
        coords_raw = row.get('Location_Coordinates', '').strip()
        lat, lng = None, None

        # Try to parse existing coords
        try:
            parts = coords_raw.split(',')
            la = float(parts[0].strip())
            lo = float(parts[1].strip())
            if 6 <= la <= 37 and 68 <= lo <= 98:
                lat, lng = la, lo
        except:
            pass

        # Fallback: use district centroid, then state centroid
        if lat is None:
            district = row.get('District', '').strip()
            state = row.get('State', '').strip()
            if district in DISTRICT_CENTROIDS:
                lat, lng = jitter(*DISTRICT_CENTROIDS[district], scale=0.08)
            elif state in STATE_CENTROIDS:
                lat, lng = jitter(*STATE_CENTROIDS[state], scale=0.15)
            else:
                continue  # Skip if no location at all

        specs = row.get('Specialties', '').strip()
        facs  = row.get('Facilities', '').strip()

        beds = 0
        try:
            beds = int(row.get('Total_Num_Beds', 0) or 0)
        except:
            pass
        if beds == 0:
            cat = row.get('Hospital_Category', '').lower()
            beds = 120 if ('government' in cat or 'public' in cat) else (60 if specs else 35)

        doc_count = 0
        try:
            doc_count = int(row.get('Number_Doctor', 0) or 0)
        except:
            pass

        icu = has_icu(specs, facs)
        spec_list = get_specialties(specs, facs)
        state_name = row.get('State', '').strip()
        district_name = row.get('District', '').strip()

        h = {
            'id': f'H{row.get("Sr_No", sr_counter)}',
            'name': row.get('Hospital_Name', 'Unknown Hospital').strip(),
            'address': row.get('Address_Original_First_Line', '').strip()[:80],
            'state': state_name,
            'district': district_name,
            'pincode': row.get('Pincode', '').strip(),
            'lat': round(lat, 5),
            'lng': round(lng, 5),
            'category': row.get('Hospital_Category', '') or 'Unknown',
            'phone': (row.get('Telephone', '') or '')[:30],
            'emergency_num': (row.get('Emergency_Num', '') or '')[:20],
            'specialties': spec_list,
            'has_icu': icu,
            'has_blood_bank': 'blood' in facs.lower() or bool((row.get('Bloodbank_Phone_No','0') or '0').strip().replace('0','')),
            'has_ambulance': 'ambulance' in facs.lower() or bool((row.get('Ambulance_Phone_No','0') or '0').strip().replace('0','')),
            'has_emergency': 'emergency' in facs.lower() or bool((row.get('Emergency_Num','') or '').strip()),
            'total_beds': beds,
            'available_beds': max(1, int(beds * 0.35)),
            'icu_beds': max(0, int(beds * 0.1)) if icu else 0,
            'available_icu': max(0, int(beds * 0.04)) if icu else 0,
            'doctors': doc_count,
            'password': f'hosp{row.get("Sr_No", sr_counter)}',
            'source': 'csv',
        }
        hospitals.append(h)
        sr_counter += 1

csv_count = len(hospitals)
print(f"CSV processed: {csv_count} hospitals")

# ────────────────────────────────────────────────────────────────────
# 2. Process GeoJSON (Uttarakhand + extra OSM hospitals)
# ────────────────────────────────────────────────────────────────────
print("Processing GeoJSON (Uttarakhand OSM data)...")

with open('export.geojson', 'r', encoding='utf-8') as f:
    geojson = json.load(f)

geojson_count = 0
for feat in geojson['features']:
    props = feat.get('properties', {})
    geom  = feat.get('geometry', {})

    if geom.get('type') != 'Point':
        continue

    coords = geom.get('coordinates', [])
    if len(coords) < 2:
        continue

    lng_g = coords[0]
    lat_g = coords[1]

    # Validate India bbox
    if not (6 <= lat_g <= 37 and 68 <= lng_g <= 98):
        continue

    name = props.get('name', props.get('official_name', '')).strip()
    if not name:
        name = 'Hospital (OSM)'

    state_g    = props.get('addr:state', 'Uttarakhand').strip() or 'Uttarakhand'
    district_g = props.get('addr:district', props.get('addr:city', props.get('addr:block', ''))).strip()
    amenity    = props.get('amenity', '')
    health     = props.get('healthcare', '')
    specialty  = props.get('healthcare:speciality', '')
    emergency  = props.get('emergency', '')
    category   = props.get('description', 'Government Hospital' if 'government' in props.get('description','').lower() else 'Private Hospital')
    beds_str   = props.get('beds', '0')

    try:
        beds_g = int(beds_str)
    except:
        beds_g = 60

    if beds_g == 0:
        beds_g = 60

    spec_list_g = get_specialties(specialty, '')
    icu_g = 'icu' in specialty.lower() or 'intensive' in specialty.lower()
    emerg_g = emergency.lower() in ['yes','designated']

    h_g = {
        'id': f'OSM{feat["id"].replace("/","_").replace("-","_")}',
        'name': name,
        'address': props.get('addr:full', props.get('addr:street', ''))[:80],
        'state': state_g,
        'district': district_g or state_g,
        'pincode': props.get('addr:postcode', ''),
        'lat': round(lat_g, 5),
        'lng': round(lng_g, 5),
        'category': category,
        'phone': props.get('phone', props.get('contact:phone', ''))[:30],
        'emergency_num': props.get('emergency:phone', '')[:20],
        'specialties': spec_list_g,
        'has_icu': icu_g,
        'has_blood_bank': 'blood' in specialty.lower(),
        'has_ambulance': 'ambulance' in props.get('healthcare', '').lower(),
        'has_emergency': emerg_g,
        'total_beds': beds_g,
        'available_beds': max(1, int(beds_g * 0.35)),
        'icu_beds': max(0, int(beds_g * 0.1)) if icu_g else 0,
        'available_icu': max(0, int(beds_g * 0.04)) if icu_g else 0,
        'doctors': 0,
        'password': f'osm{str(feat["id"]).replace("/","").replace("-","")}',
        'source': 'osm',
    }
    hospitals.append(h_g)
    geojson_count += 1

print(f"GeoJSON processed: {geojson_count} hospitals from Uttarakhand/OSM")

# ── Stats
total = len(hospitals)
states_count = {}
for h in hospitals:
    s = h['state']
    states_count[s] = states_count.get(s, 0) + 1

icu_total = sum(1 for h in hospitals if h['has_icu'])
print(f"\n[STATS] Final Stats:")
print(f"  Total hospitals: {total}")
print(f"  ICU facilities: {icu_total}")
print(f"  States covered: {len(states_count)}")
print(f"\n  Top 10 states:")
for s, c in sorted(states_count.items(), key=lambda x: -x[1])[:10]:
    print(f"    {s}: {c}")

# Write output
os.makedirs('lifegrid/data', exist_ok=True)
with open('lifegrid/data/hospitals.js', 'w', encoding='utf-8') as f:
    f.write('// LIFEGRID Hospital Data -- All India + OSM Uttarakhand\n')
    f.write('const HOSPITAL_DATA = ')
    json.dump(hospitals, f, ensure_ascii=False, separators=(',', ':'))
    f.write(';\n')

size_mb = os.path.getsize('lifegrid/data/hospitals.js') / 1024 / 1024
print(f"\nSaved hospitals.js -- {total} entries, {size_mb:.2f} MB")

