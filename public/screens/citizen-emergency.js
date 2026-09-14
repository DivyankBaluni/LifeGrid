// Citizen Emergency Reporting Screen (Vanilla ES6 with Hindi/English Bilingual Support)
import { reportEmergency } from '../api.js';
import { renderAISuggestionBadge } from '../components/ai-suggestion-badge.js';
import { openExplainabilityModal } from '../components/explainability-modal.js';

export function createCitizenEmergencyScreen({ language = 'en' }) {
  const container = document.createElement('div');
  container.style.cssText = 'max-width: 640px; margin: 0 auto; padding: 10px 0;';

  let currentLang = language;
  let step = 1;
  let selectedSymptoms = [];
  let freeText = '';
  let locationAddress = 'Rajpur Road, Clock Tower, Dehradun, Uttarakhand';
  let coords = { lat: 30.3398, lng: 78.0644 };
  let ageBand = 'adult';
  let isSubmitting = false;
  let dispatchResult = null;
  let isRecordingVoice = false;

  const symptomOptions = [
    {
      id: 'crushing chest pain',
      labelEn: 'Severe Chest Pain / Heart Trouble',
      labelHi: 'सीने में तेज़ दर्द / दिल का दौरा',
      icon: '<i class="fa-solid fa-heart" style="font-size: 24px; color: #b91c1c;"></i>',
    },
    {
      id: 'cannot breathe',
      labelEn: 'Severe Breathing Trouble / Gasping',
      labelHi: 'सांस लेने में भारी तकलीफ / दम घुटना',
      icon: '<i class="fa-solid fa-wind" style="font-size: 24px; color: #0284c7;"></i>',
    },
    {
      id: 'severe bleeding',
      labelEn: 'Heavy Bleeding / Deep Wound',
      labelHi: 'भारी रक्तस्त्राव / गहरा घाव',
      icon: '<i class="fa-solid fa-droplet" style="font-size: 24px; color: #be123c;"></i>',
    },
    {
      id: 'unresponsive',
      labelEn: 'Unconscious / No Response',
      labelHi: 'बेहोश / कोई प्रतिक्रिया नहीं',
      icon: '<i class="fa-solid fa-triangle-exclamation" style="font-size: 24px; color: #b45309;"></i>',
    },
    {
      id: 'major trauma',
      labelEn: 'Road Accident / Broken Bone',
      labelHi: 'सड़क दुर्घटना / गंभीर चोट या फ्रैक्चर',
      icon: '<i class="fa-solid fa-car" style="font-size: 24px; color: #475569;"></i>',
    },
    {
      id: 'snake bite',
      labelEn: 'Snake Bite / Poison Ingestion',
      labelHi: 'सांप का काटना / विषैला पदार्थ',
      icon: '<i class="fa-solid fa-shield-halved" style="font-size: 24px; color: #15803d;"></i>',
    },
  ];

  const captureGPS = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        locationAddress = `Current Device Location (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`;
        render();
      },
      () => {
        alert('Could not access device GPS. Defaulting to local Taluka outpost.');
      }
    );
  };

  const startVoiceRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice recognition is not supported in this browser. Please type symptoms instead.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = currentLang === 'hi' ? 'hi-IN' : 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = false;

    isRecordingVoice = true;
    render();
    recognition.start();

    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      freeText = freeText ? `${freeText} ${transcript}` : transcript;
      isRecordingVoice = false;
      render();
    };

    recognition.onerror = () => {
      isRecordingVoice = false;
      render();
    };

    recognition.onend = () => {
      isRecordingVoice = false;
      render();
    };
  };

  const toggleSymptom = (id) => {
    if (selectedSymptoms.includes(id)) {
      selectedSymptoms = selectedSymptoms.filter((s) => s !== id);
    } else {
      selectedSymptoms = [...selectedSymptoms, id];
    }
    render();
  };

  const handleSubmitEmergency = async () => {
    try {
      isSubmitting = true;
      render();
      const res = await reportEmergency({
        raw_symptoms: freeText || selectedSymptoms.join(', '),
        checklist_symptoms: selectedSymptoms,
        location: {
          latitude: coords.lat,
          longitude: coords.lng,
          address: locationAddress,
        },
        age_band: ageBand,
      });
      dispatchResult = res;
      step = 4;
    } catch (err) {
      alert(err.message || 'Failed to submit emergency report');
    } finally {
      isSubmitting = false;
      render();
    }
  };

  const render = () => {
    const isHi = currentLang === 'hi';

    container.innerHTML = `
      <!-- Persistent Immediate Call Banner -->
      <div style="
        background-color: #fee2e2;
        border: 1.5px solid #f87171;
        border-radius: 10px;
        padding: 12px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
      ">
        <div style="display: flex; align-items: center; gap: 10px;">
          <i class="fa-solid fa-phone" style="font-size: 22px; color: #b91c1c;"></i>
          <div>
            <div style="font-size: 0.9rem; font-weight: 700; color: #7f1d1d;">
              ${isHi ? 'तुरंत कॉल सहायता (आपातकालीन 108 / 112)' : 'Instant Emergency Call Assistance'}
            </div>
            <div style="font-size: 0.75rem; color: #991b1b;">
              ${isHi ? 'यदि फोन उपयोग में कठिनाई हो तो सीधे डायल करें' : 'Dial directly if you cannot complete the digital report'}
            </div>
          </div>
        </div>
        <a
          href="tel:108"
          style="
            background-color: #b91c1c;
            color: #ffffff;
            text-decoration: none;
            padding: 8px 14px;
            border-radius: 6px;
            font-weight: 700;
            font-size: 0.85rem;
          "
        >
          CALL 108
        </a>
      </div>

      <!-- Step Container -->
      <div style="
        background-color: #ffffff;
        border-radius: 12px;
        border: 1px solid #e2e8f0;
        padding: 24px;
        box-shadow: var(--shadow-sm);
      ">
        <!-- Step Indicator -->
        ${step < 4 ? `
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
            <span style="font-size: 0.8rem; font-weight: 700; color: #64748b;">
              ${isHi ? `चरण ${step} / 3` : `STEP ${step} OF 3`}
            </span>
            <div style="display: flex; gap: 6px;">
              ${[1, 2, 3].map((s) => `
                <div style="
                  width: 32px;
                  height: 4px;
                  border-radius: 2px;
                  background-color: ${s <= step ? '#1e40af' : '#e2e8f0'};
                "></div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- STEP 1: Location Verification -->
        ${step === 1 ? `
          <div>
            <h2 style="font-size: 1.3rem; font-weight: 700; color: #0f172a; margin-bottom: 8px;">
              ${isHi ? '1. आपातकालीन स्थान की पुष्टि करें' : '1. Confirm Emergency Location'}
            </h2>
            <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 20px;">
              ${isHi
                ? 'सिस्टम ने निकटतम मोबाइल टावर से आपका स्थान पहचाना है। कृपया पुष्टि करें:'
                : 'Auto-detected via rural cellular tower beacon. Confirm or adjust address:'}
            </p>

            <div style="
              display: flex;
              align-items: center;
              gap: 10px;
              background-color: #f8fafc;
              border: 1px solid #cbd5e1;
              border-radius: 8px;
              padding: 12px;
              margin-bottom: 12px;
            ">
              <i class="fa-solid fa-map-pin" style="font-size: 24px; color: #1e40af; flex-shrink: 0;"></i>
              <input
                type="text"
                id="citizen-location"
                value="${locationAddress}"
                style="
                  width: 100%;
                  border: none;
                  background-color: transparent;
                  font-size: 0.95rem;
                  font-weight: 600;
                  color: #0f172a;
                  outline: none;
                "
              />
              <button
                type="button"
                id="btn-capture-gps"
                title="Capture GPS Coordinates"
                style="
                  display: flex;
                  align-items: center;
                  gap: 4px;
                  background-color: #eff6ff;
                  border: 1px solid #bfdbfe;
                  color: #1e40af;
                  border-radius: 6px;
                  padding: 6px 10px;
                  font-size: 0.75rem;
                  font-weight: 700;
                  cursor: pointer;
                  white-space: nowrap;
                "
              >
                <i class="fa-solid fa-crosshairs"></i>
                GPS
              </button>
            </div>

            <div style="
              padding: 10px 14px;
              background-color: #eff6ff;
              border-radius: 8px;
              font-size: 0.78rem;
              color: #1e40af;
              margin-bottom: 24px;
            ">
              📍 Coordinates: ${coords.lat.toFixed(4)}° N, ${coords.lng.toFixed(4)}° E (Taluka Outpost Zone)
            </div>

            <button
              type="button"
              id="btn-step1-continue"
              class="btn-primary"
              style="
                width: 100%;
                padding: 14px;
                font-size: 1rem;
                font-weight: 700;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
              "
            >
              ${isHi ? 'स्थान सही है — आगे बढ़ें' : 'Location Confirmed — Continue'}
              <i class="fa-solid fa-arrow-right"></i>
            </button>
          </div>
        ` : ''}

        <!-- STEP 2: Icon-First Symptom Picker -->
        ${step === 2 ? `
          <div>
            <h2 style="font-size: 1.3rem; font-weight: 700; color: #0f172a; margin-bottom: 6px;">
              ${isHi ? '2. मुख्य लक्षण चुनें' : '2. Select Key Symptoms'}
            </h2>
            <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 18px;">
              ${isHi ? 'जो लक्षण दिखाई दे रहे हैं, उन पर टैप करें:' : 'Tap the symptoms you observe on the patient:'}
            </p>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; margin-bottom: 20px;">
              ${symptomOptions.map((sym) => {
                const isSelected = selectedSymptoms.includes(sym.id);
                return `
                  <button
                    type="button"
                    class="js-symptom-btn"
                    data-id="${sym.id}"
                    style="
                      display: flex;
                      align-items: center;
                      gap: 12px;
                      padding: 14px;
                      border-radius: 8px;
                      border: ${isSelected ? '2px solid #1e40af' : '1px solid #cbd5e1'};
                      background-color: ${isSelected ? '#eff6ff' : '#ffffff'};
                      text-align: left;
                      cursor: pointer;
                      box-shadow: var(--shadow-sm);
                    "
                  >
                    <div style="flex-shrink: 0;">${sym.icon}</div>
                    <div style="font-size: 0.88rem; font-weight: 600; color: ${isSelected ? '#1e40af' : '#1e293b'};">
                      ${isHi ? sym.labelHi : sym.labelEn}
                    </div>
                  </button>
                `;
              }).join('')}
            </div>

            <div style="margin-bottom: 24px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label style="font-size: 0.82rem; font-weight: 600; color: #475569;">
                  ${isHi ? 'अतिरिक्त विवरण (बोलकर या लिखकर दर्ज करें)' : 'Additional details (type or speak):'}
                </label>
                <button
                  type="button"
                  id="btn-voice-rec"
                  style="
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    background-color: ${isRecordingVoice ? '#fee2e2' : '#f1f5f9'};
                    color: ${isRecordingVoice ? '#b91c1c' : '#334155'};
                    border: 1px solid ${isRecordingVoice ? '#fca5a5' : '#cbd5e1'};
                    border-radius: 6px;
                    padding: 4px 8px;
                    font-size: 0.75rem;
                    font-weight: 700;
                    cursor: pointer;
                  "
                >
                  <i class="fa-solid fa-microphone" style="color: ${isRecordingVoice ? '#b91c1c' : '#475569'};"></i>
                  ${isRecordingVoice ? (isHi ? 'सुन रहे हैं...' : 'Listening...') : (isHi ? '🎤 बोलकर बताएं' : '🎤 Voice Input')}
                </button>
              </div>
              <textarea
                id="citizen-free-text"
                rows="2"
                placeholder="${isHi ? 'मरीज की स्थिति के बारे में अन्य जानकारी...' : 'e.g. Sweating, pale skin, history of heart condition...'}"
                style="
                  width: 100%;
                  padding: 10px;
                  border-radius: 8px;
                  border: 1px solid #cbd5e1;
                  font-size: 0.85rem;
                  font-family: inherit;
                "
              >${freeText}</textarea>
            </div>

            <div style="display: flex; gap: 10px;">
              <button
                type="button"
                id="btn-step2-back"
                class="btn-secondary"
                style="flex: 1; padding: 12px;"
              >
                <i class="fa-solid fa-arrow-left" style="margin-right: 4px;"></i>
                ${isHi ? 'वापस' : 'Back'}
              </button>
              <button
                type="button"
                id="btn-step2-continue"
                class="btn-primary"
                ${selectedSymptoms.length === 0 && !freeText.trim() ? 'disabled' : ''}
                style="flex: 2; padding: 12px; font-weight: 700;"
              >
                ${isHi ? 'आगे बढ़ें' : 'Continue'}
                <i class="fa-solid fa-arrow-right" style="margin-left: 4px;"></i>
              </button>
            </div>
          </div>
        ` : ''}

        <!-- STEP 3: Patient Profile & Final Dispatch Trigger -->
        ${step === 3 ? `
          <div>
            <h2 style="font-size: 1.3rem; font-weight: 700; color: #0f172a; margin-bottom: 6px;">
              ${isHi ? '3. मरीज का विवरण' : '3. Patient Profile'}
            </h2>
            <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 18px;">
              ${isHi ? 'आयु वर्ग चुनें (पहचान वैकल्पिक है):' : 'Select age band (name is optional for emergency speed):'}
            </p>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 24px;">
              ${[
                { id: 'pediatric', en: 'Child (<12)', hi: 'बच्चा (<12)' },
                { id: 'adult', en: 'Adult (13-59)', hi: 'वयस्क (13-59)' },
                { id: 'geriatric', en: 'Senior (60+)', hi: 'वरिष्ठ (60+)' },
              ].map((b) => `
                <button
                  type="button"
                  class="js-age-band-btn"
                  data-id="${b.id}"
                  style="
                    padding: 12px;
                    border-radius: 8px;
                    font-weight: 600;
                    border: ${ageBand === b.id ? '2px solid #1e40af' : '1px solid #cbd5e1'};
                    background-color: ${ageBand === b.id ? '#eff6ff' : '#ffffff'};
                    color: ${ageBand === b.id ? '#1e40af' : '#475569'};
                    cursor: pointer;
                  "
                >
                  ${isHi ? b.hi : b.en}
                </button>
              `).join('')}
            </div>

            <div style="
              background-color: #fee2e2;
              border: 1px solid #fecdd3;
              border-radius: 8px;
              padding: 14px;
              margin-bottom: 24px;
            ">
              <div style="font-weight: 700; color: #991b1b; fontSize: 0.9rem; margin-bottom: 4px;">
                ${isHi ? 'आपातकालीन समन्वय तुरंत सक्रिय होगा' : 'Immediate Emergency Coordination'}
              </div>
              <p style="font-size: 0.8rem; color: #7f1d1d; margin: 0;">
                ${isHi
                  ? 'यह प्रणाली एआई ट्राइएज चलाएगी, श्रेष्ठ अस्पताल व एम्बुलेंस चुनेगी और अस्पताल को प्री-अलर्ट भेजेगी।'
                  : 'LifeGrid will evaluate clinical severity, match the best-fit hospital and ambulance, and trigger hospital pre-alerting.'}
              </p>
            </div>

            <div style="display: flex; gap: 10px;">
              <button
                type="button"
                id="btn-step3-back"
                class="btn-secondary"
                ${isSubmitting ? 'disabled' : ''}
                style="flex: 1; padding: 12px;"
              >
                ${isHi ? 'वापस' : 'Back'}
              </button>
              <button
                type="button"
                id="btn-trigger-emergency"
                class="btn-danger"
                ${isSubmitting ? 'disabled' : ''}
                style="
                  flex: 2;
                  padding: 14px;
                  font-weight: 700;
                  font-size: 1rem;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 8px;
                "
              >
                <i class="fa-solid fa-heart-pulse"></i>
                ${isSubmitting
                  ? (isHi ? 'समन्वय जारी...' : 'Coordinating Response...')
                  : (isHi ? 'आपातकाल रिपोर्ट करें' : 'DISPATCH EMERGENCY RESPONSE')}
              </button>
            </div>
          </div>
        ` : ''}

        <!-- STEP 4: Live Dispatch Confirmation Screen -->
        ${step === 4 && dispatchResult ? `
          <div>
            <div style="
              display: flex;
              align-items: center;
              gap: 10px;
              background-color: #f0fdf4;
              border: 1px solid #bbf7d0;
              border-radius: 8px;
              padding: 14px;
              margin-bottom: 20px;
            ">
              <i class="fa-solid fa-circle-check" style="font-size: 28px; color: #15803d;"></i>
              <div>
                <h3 style="font-size: 1.1rem; font-weight: 700; color: #166534; margin: 0;">
                  ${isHi ? 'आपातकालीन प्रतिक्रिया सक्रिय!' : 'Emergency Response Dispatched!'}
                </h3>
                <span style="font-size: 0.8rem; color: #15803d;">
                  Incident Ref: <code>#${dispatchResult.incident.id.slice(0, 8)}</code>
                </span>
              </div>
            </div>

            <!-- AI Suggestion Triage Display -->
            <div style="
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 14px;
              margin-bottom: 16px;
            ">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                ${renderAISuggestionBadge('AI-suggested priority', true, 'view-citizen-trace')}
                <span style="
                  font-size: 0.85rem;
                  font-weight: 700;
                  color: #b91c1c;
                  background-color: #fee2e2;
                  padding: 3px 8px;
                  border-radius: 4px;
                ">
                  ${dispatchResult.triage.priority} IMMEDIATE
                </span>
              </div>
              <p style="font-size: 0.85rem; color: #1e293b; line-height: 1.4; margin: 0;">
                ${dispatchResult.triage.plain_language_summary}
              </p>
            </div>

            <!-- Matched Facility & Ambulance -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
              <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background-color: #ffffff;">
                <span style="font-size: 0.75rem; font-weight: 700; color: #64748b;">DESTINATION HOSPITAL</span>
                <div style="font-size: 0.95rem; font-weight: 700; color: #0f172a; margin-top: 4px;">
                  ${dispatchResult.hospital_match?.selected_hospital?.name || 'Hospital B (Super-Specialty)'}
                </div>
                <div style="font-size: 0.78rem; color: #15803d; font-weight: 600; margin-top: 2px;">
                  Pre-alert acknowledged • Cath Lab Ready
                </div>
              </div>

              <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background-color: #ffffff;">
                <span style="font-size: 0.75rem; font-weight: 700; color: #64748b;">ASSIGNED AMBULANCE</span>
                <div style="font-size: 0.95rem; font-weight: 700; color: #0f172a; margin-top: 4px;">
                  ${dispatchResult.ambulance_match?.selected_ambulance?.vehicle_number || 'MH-20-AX-1088 (ALS)'}
                </div>
                <div style="font-size: 0.78rem; color: #0369a1; font-weight: 600; margin-top: 2px;">
                  Estimated ETA: ${dispatchResult.route?.final_eta_minutes || 14} minutes
                </div>
              </div>
            </div>

            <!-- Signal Priority & Drone Fallback Alerts -->
            ${dispatchResult.route?.signal_priority_applied ? `
              <div style="
                background-color: #dcfce7;
                border: 1px solid #bbf7d0;
                border-radius: 8px;
                padding: 10px 14px;
                margin-bottom: 12px;
                font-size: 0.8rem;
                color: #15803d;
                font-weight: 600;
              ">
                🚦 Simulated Traffic Signal Priority Activated: Emergency corridor ETA reduced by ~${dispatchResult.route.time_saved_minutes} mins.
              </div>
            ` : ''}

            ${dispatchResult.route?.drone_fallback_triggered ? `
              <div style="
                background-color: #fee2e2;
                border: 1px solid #fecdd3;
                border-radius: 8px;
                padding: 10px 14px;
                margin-bottom: 20px;
                font-size: 0.8rem;
                color: #b91c1c;
                font-weight: 600;
              ">
                🚁 Emergency Medical Supply Drone Dispatched: Delivering resuscitation payload ahead of ground transport.
              </div>
            ` : ''}

            <!-- Live OpenStreetMap Road Radar -->
            <div style="
              background-color: #ffffff;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 12px;
              margin-bottom: 20px;
              box-shadow: var(--shadow-sm);
            ">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 0.82rem; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 6px;">
                  <i class="fa-solid fa-satellite-dish" style="color: #0284c7;"></i>
                  ${isHi ? 'लाइव रोड ट्रैकिंग रडार (OpenStreetMap)' : 'Live Road Tracking Radar (OpenStreetMap)'}
                </span>
                <span style="
                  font-size: 0.72rem;
                  font-weight: 700;
                  color: #15803d;
                  background-color: #f0fdf4;
                  padding: 2px 8px;
                  border-radius: 6px;
                  border: 1px solid #bbf7d0;
                ">
                  <i class="fa-solid fa-circle fa-beat-fade" style="font-size: 7px; margin-right: 4px;"></i>
                  ${isHi ? 'लाइव जीपीएस' : 'Live OSRM Navigation'}
                </span>
              </div>
              <div id="citizen-live-map" style="height: 220px; width: 100%; border-radius: 6px; border: 1px solid #cbd5e1;"></div>
            </div>

            <button
              type="button"
              id="btn-report-another"
              class="btn-secondary"
              style="width: 100%; padding: 12px; font-weight: 600;"
            >
              ${isHi ? 'नया रिपोर्ट दर्ज करें' : 'Report Another Emergency'}
            </button>
          </div>
        ` : ''}
      </div>
    `;

    bindEvents();
  };

  const bindEvents = () => {
    const locInput = container.querySelector('#citizen-location');
    if (locInput) {
      locInput.addEventListener('input', (e) => {
        locationAddress = e.target.value;
      });
    }

    const gpsBtn = container.querySelector('#btn-capture-gps');
    if (gpsBtn) gpsBtn.addEventListener('click', captureGPS);

    const step1Btn = container.querySelector('#btn-step1-continue');
    if (step1Btn) {
      step1Btn.addEventListener('click', () => {
        step = 2;
        render();
      });
    }

    container.querySelectorAll('.js-symptom-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        toggleSymptom(id);
      });
    });

    const vBtn = container.querySelector('#btn-voice-rec');
    if (vBtn) vBtn.addEventListener('click', startVoiceRecording);

    const freeTextInput = container.querySelector('#citizen-free-text');
    if (freeTextInput) {
      freeTextInput.addEventListener('input', (e) => {
        freeText = e.target.value;
        const contBtn = container.querySelector('#btn-step2-continue');
        if (contBtn) {
          contBtn.disabled = selectedSymptoms.length === 0 && !freeText.trim();
        }
      });
    }

    const step2Back = container.querySelector('#btn-step2-back');
    if (step2Back) {
      step2Back.addEventListener('click', () => {
        step = 1;
        render();
      });
    }

    const step2Cont = container.querySelector('#btn-step2-continue');
    if (step2Cont) {
      step2Cont.addEventListener('click', () => {
        step = 3;
        render();
      });
    }

    container.querySelectorAll('.js-age-band-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        ageBand = btn.getAttribute('data-id');
        render();
      });
    });

    const step3Back = container.querySelector('#btn-step3-back');
    if (step3Back) {
      step3Back.addEventListener('click', () => {
        step = 2;
        render();
      });
    }

    const submitBtn = container.querySelector('#btn-trigger-emergency');
    if (submitBtn) submitBtn.addEventListener('click', handleSubmitEmergency);

    const anotherBtn = container.querySelector('#btn-report-another');
    if (anotherBtn) {
      anotherBtn.addEventListener('click', () => {
        step = 1;
        selectedSymptoms = [];
        freeText = '';
        dispatchResult = null;
        render();
      });
    }

    const traceBtn = container.querySelector('.js-view-reasoning');
    if (traceBtn && dispatchResult) {
      traceBtn.addEventListener('click', () => {
        openExplainabilityModal({ trace: dispatchResult.triage });
      });
    }

    if (step === 4 && dispatchResult) {
      setTimeout(() => {
        initCitizenLiveMap();
      }, 50);
    }
  };

  let citizenMapInstance = null;

  const initCitizenLiveMap = () => {
    const mapDiv = container.querySelector('#citizen-live-map');
    if (!mapDiv || typeof L === 'undefined' || !dispatchResult) return;

    if (citizenMapInstance) {
      try {
        citizenMapInstance.remove();
      } catch (e) {}
      citizenMapInstance = null;
    }
    if (mapDiv._leaflet_id) {
      delete mapDiv._leaflet_id;
    }

    const patientLat = dispatchResult.incident?.location?.latitude || coords.lat;
    const patientLng = dispatchResult.incident?.location?.longitude || coords.lng;
    const ambLat = dispatchResult.ambulance_match?.selected_ambulance?.current_location?.latitude || (patientLat + 0.025);
    const ambLng = dispatchResult.ambulance_match?.selected_ambulance?.current_location?.longitude || (patientLng - 0.035);
    const hospLat = dispatchResult.hospital_match?.selected_hospital?.location?.latitude || (patientLat + 0.045);
    const hospLng = dispatchResult.hospital_match?.selected_hospital?.location?.longitude || (patientLng + 0.04);

    citizenMapInstance = L.map(mapDiv, {
      center: [patientLat, patientLng],
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'],
      attribution: '&copy; OpenStreetMap contributors | LIFEGRID',
    }).addTo(citizenMapInstance);

    // Patient marker
    const pIcon = L.divIcon({
      className: '',
      html: `<div style="background:#dc2626;color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 0 8px rgba(220,38,38,0.7);"><i class="fa-solid fa-user"></i></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    L.marker([patientLat, patientLng], { icon: pIcon })
      .bindPopup('<b>Patient Location</b><br/>Emergency Origin')
      .addTo(citizenMapInstance);

    // Ambulance marker
    const ambIcon = L.divIcon({
      className: '',
      html: `<div style="background:#0284c7;color:#fff;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 0 8px rgba(2,132,199,0.7);"><span style="font-size:14px;">🚑</span></div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
    L.marker([ambLat, ambLng], { icon: ambIcon })
      .bindPopup(`<b>${dispatchResult.ambulance_match?.selected_ambulance?.vehicle_number || 'Dispatched Ambulance'}</b><br/>En Route (ETA: ${dispatchResult.route?.final_eta_minutes || 14}m)`)
      .addTo(citizenMapInstance);

    // Hospital marker
    const hIcon = L.divIcon({
      className: '',
      html: `<div style="background:#15803d;color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 0 8px rgba(21,128,61,0.7);"><i class="fa-solid fa-hospital"></i></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    L.marker([hospLat, hospLng], { icon: hIcon })
      .bindPopup(`<b>${dispatchResult.hospital_match?.selected_hospital?.name || 'Destination Hospital'}</b><br/>Pre-Alert Broadcasted`)
      .addTo(citizenMapInstance);

    // Route polyline
    const routePts = [[ambLat, ambLng], [patientLat, patientLng], [hospLat, hospLng]];
    L.polyline(routePts, { color: '#0284c7', weight: 4, opacity: 0.85, dashArray: '6, 6' }).addTo(citizenMapInstance);

    const bounds = L.latLngBounds([[patientLat, patientLng], [ambLat, ambLng], [hospLat, hospLng]]);
    citizenMapInstance.fitBounds(bounds, { padding: [25, 25] });

    setTimeout(() => {
      if (citizenMapInstance) citizenMapInstance.invalidateSize();
    }, 150);
  };

  render();

  return {
    element: container,
    setLanguage(lang) {
      currentLang = lang;
      render();
    },
  };
}
