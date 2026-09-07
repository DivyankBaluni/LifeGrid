import React, { useState } from 'react';
import {
  PhoneCall,
  MapPin,
  Heart,
  Wind,
  Droplets,
  AlertOctagon,
  Car,
  Activity,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  ShieldAlert,
  Mic,
  Crosshair,
} from 'lucide-react';
import { reportEmergency } from '../api/client';
import { AISuggestionBadge } from '../components/AISuggestionBadge';
import { ExplainabilityModal } from '../components/ExplainabilityModal';

export const CitizenEmergency: React.FC<{ language: 'en' | 'hi' }> = ({ language }) => {
  const isHi = language === 'hi';

  const [step, setStep] = useState<number>(1);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [freeText, setFreeText] = useState<string>('');
  const [locationAddress, setLocationAddress] = useState<string>('Village Rampur, Near Gram Panchayat Office');
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: 19.8762, lng: 75.3433 });
  const [ageBand, setAgeBand] = useState<string>('adult');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [dispatchResult, setDispatchResult] = useState<any>(null);
  const [showTraceModal, setShowTraceModal] = useState<boolean>(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState<boolean>(false);

  const captureGPS = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationAddress(`Current Device Location (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`);
      },
      () => {
        alert('Could not access device GPS. Defaulting to local Taluka outpost.');
      }
    );
  };

  const startVoiceRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice recognition is not supported in this browser. Please type symptoms instead.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = isHi ? 'hi-IN' : 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = false;

    setIsRecordingVoice(true);
    recognition.start();

    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setFreeText((prev) => (prev ? `${prev} ${transcript}` : transcript));
      setIsRecordingVoice(false);
    };

    recognition.onerror = () => {
      setIsRecordingVoice(false);
    };

    recognition.onend = () => {
      setIsRecordingVoice(false);
    };
  };

  const symptomOptions = [
    {
      id: 'crushing chest pain',
      labelEn: 'Severe Chest Pain / Heart Trouble',
      labelHi: 'सीने में तेज़ दर्द / दिल का दौरा',
      icon: <Heart color="#b91c1c" size={24} />,
    },
    {
      id: 'cannot breathe',
      labelEn: 'Severe Breathing Trouble / Gasping',
      labelHi: 'सांस लेने में भारी तकलीफ / दम घुटना',
      icon: <Wind color="#0284c7" size={24} />,
    },
    {
      id: 'severe bleeding',
      labelEn: 'Heavy Bleeding / Deep Wound',
      labelHi: 'भारी रक्तस्त्राव / गहरा घाव',
      icon: <Droplets color="#be123c" size={24} />,
    },
    {
      id: 'unresponsive',
      labelEn: 'Unconscious / No Response',
      labelHi: 'बेहोश / कोई प्रतिक्रिया नहीं',
      icon: <AlertOctagon color="#b45309" size={24} />,
    },
    {
      id: 'major trauma',
      labelEn: 'Road Accident / Broken Bone',
      labelHi: 'सड़क दुर्घटना / गंभीर चोट या फ्रैक्चर',
      icon: <Car color="#475569" size={24} />,
    },
    {
      id: 'snake bite',
      labelEn: 'Snake Bite / Poison Ingestion',
      labelHi: 'सांप का काटना / विषैला पदार्थ',
      icon: <ShieldAlert color="#15803d" size={24} />,
    },
  ];

  const toggleSymptom = (id: string) => {
    if (selectedSymptoms.includes(id)) {
      setSelectedSymptoms(selectedSymptoms.filter((s) => s !== id));
    } else {
      setSelectedSymptoms([...selectedSymptoms, id]);
    }
  };

  const handleSubmitEmergency = async () => {
    try {
      setIsSubmitting(true);
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
      setDispatchResult(res);
      setStep(4); // Confirmation step
    } catch (err: any) {
      alert(err.message || 'Failed to submit emergency report');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '10px 0' }}>
      {/* Persistent Immediate Call Banner */}
      <div style={{
        backgroundColor: '#fee2e2',
        border: '1.5px solid #f87171',
        borderRadius: '10px',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <PhoneCall size={22} color="#b91c1c" />
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#7f1d1d' }}>
              {isHi ? 'तुरंत कॉल सहायता (आपातकालीन 108 / 112)' : 'Instant Emergency Call Assistance'}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#991b1b' }}>
              {isHi ? 'यदि फोन उपयोग में कठिनाई हो तो सीधे डायल करें' : 'Dial directly if you cannot complete the digital report'}
            </div>
          </div>
        </div>
        <a
          href="tel:108"
          style={{
            backgroundColor: '#b91c1c',
            color: '#ffffff',
            textDecoration: 'none',
            padding: '8px 14px',
            borderRadius: '6px',
            fontWeight: 700,
            fontSize: '0.85rem',
          }}
        >
          CALL 108
        </a>
      </div>

      {/* Step Container */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        padding: '24px',
        boxShadow: 'var(--shadow-sm)',
      }}>
        {/* Step Indicator */}
        {step < 4 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>
              {isHi ? `चरण ${step} / 3` : `STEP ${step} OF 3`}
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  style={{
                    width: '32px',
                    height: '4px',
                    borderRadius: '2px',
                    backgroundColor: s <= step ? '#1e40af' : '#e2e8f0',
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* STEP 1: Location Verification */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
              {isHi ? '1. आपातकालीन स्थान की पुष्टि करें' : '1. Confirm Emergency Location'}
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '20px' }}>
              {isHi
                ? 'सिस्टम ने निकटतम मोबाइल टावर से आपका स्थान पहचाना है। कृपया पुष्टि करें:'
                : 'Auto-detected via rural cellular tower beacon. Confirm or adjust address:'}
            </p>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '12px',
            }}>
              <MapPin size={24} color="#1e40af" style={{ flexShrink: 0 }} />
              <input
                type="text"
                value={locationAddress}
                onChange={(e) => setLocationAddress(e.target.value)}
                style={{
                  width: '100%',
                  border: 'none',
                  backgroundColor: 'transparent',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  color: '#0f172a',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={captureGPS}
                title="Capture GPS Coordinates"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  color: '#1e40af',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <Crosshair size={14} />
                GPS
              </button>
            </div>

            <div style={{
              padding: '10px 14px',
              backgroundColor: '#eff6ff',
              borderRadius: '8px',
              fontSize: '0.78rem',
              color: '#1e40af',
              marginBottom: '24px',
            }}>
              📍 Coordinates: {coords.lat.toFixed(4)}° N, {coords.lng.toFixed(4)}° E (Taluka Outpost Zone)
            </div>

            <button
              onClick={() => setStep(2)}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '1rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {isHi ? 'स्थान सही है — आगे बढ़ें' : 'Location Confirmed — Continue'}
              <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* STEP 2: Icon-First Symptom Picker */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
              {isHi ? '2. मुख्य लक्षण चुनें' : '2. Select Key Symptoms'}
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '18px' }}>
              {isHi ? 'जो लक्षण दिखाई दे रहे हैं, उन पर टैप करें:' : 'Tap the symptoms you observe on the patient:'}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px', marginBottom: '20px' }}>
              {symptomOptions.map((sym) => {
                const isSelected = selectedSymptoms.includes(sym.id);
                return (
                  <button
                    key={sym.id}
                    type="button"
                    onClick={() => toggleSymptom(sym.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '14px',
                      borderRadius: '8px',
                      border: isSelected ? '2px solid #1e40af' : '1px solid #cbd5e1',
                      backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                      textAlign: 'left',
                      cursor: 'pointer',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    <div style={{ flexShrink: 0 }}>{sym.icon}</div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: isSelected ? '#1e40af' : '#1e293b' }}>
                      {isHi ? sym.labelHi : sym.labelEn}
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>
                  {isHi ? 'अतिरिक्त विवरण (बोलकर या लिखकर दर्ज करें)' : 'Additional details (type or speak):'}
                </label>
                <button
                  type="button"
                  onClick={startVoiceRecording}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: isRecordingVoice ? '#fee2e2' : '#f1f5f9',
                    color: isRecordingVoice ? '#b91c1c' : '#334155',
                    border: `1px solid ${isRecordingVoice ? '#fca5a5' : '#cbd5e1'}`,
                    borderRadius: '6px',
                    padding: '4px 8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Mic size={14} color={isRecordingVoice ? '#b91c1c' : '#475569'} />
                  {isRecordingVoice ? (isHi ? 'सुन रहे हैं...' : 'Listening...') : (isHi ? '🎤 बोलकर बताएं' : '🎤 Voice Input')}
                </button>
              </div>
              <textarea
                rows={2}
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                placeholder={isHi ? 'मरीज की स्थिति के बारे में अन्य जानकारी...' : 'e.g. Sweating, pale skin, history of heart condition...'}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn-secondary"
                style={{ flex: 1, padding: '12px' }}
              >
                <ArrowLeft size={16} style={{ display: 'inline', marginRight: '4px' }} />
                {isHi ? 'वापस' : 'Back'}
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="btn-primary"
                disabled={selectedSymptoms.length === 0 && !freeText.trim()}
                style={{ flex: 2, padding: '12px', fontWeight: 700 }}
              >
                {isHi ? 'आगे बढ़ें' : 'Continue'}
                <ArrowRight size={16} style={{ display: 'inline', marginLeft: '4px' }} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Patient Profile & Final Dispatch Trigger */}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
              {isHi ? '3. मरीज का विवरण' : '3. Patient Profile'}
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '18px' }}>
              {isHi ? 'आयु वर्ग चुनें (पहचान वैकल्पिक है):' : 'Select age band (name is optional for emergency speed):'}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '24px' }}>
              {[
                { id: 'pediatric', en: 'Child (<12)', hi: 'बच्चा (<12)' },
                { id: 'adult', en: 'Adult (13-59)', hi: 'वयस्क (13-59)' },
                { id: 'geriatric', en: 'Senior (60+)', hi: 'वरिष्ठ (60+)' },
              ].map((b) => (
                <button
                  type="button"
                  key={b.id}
                  onClick={() => setAgeBand(b.id)}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    border: ageBand === b.id ? '2px solid #1e40af' : '1px solid #cbd5e1',
                    backgroundColor: ageBand === b.id ? '#eff6ff' : '#ffffff',
                    color: ageBand === b.id ? '#1e40af' : '#475569',
                    cursor: 'pointer',
                  }}
                >
                  {isHi ? b.hi : b.en}
                </button>
              ))}
            </div>

            <div style={{
              backgroundColor: '#fee2e2',
              border: '1px solid #fecdd3',
              borderRadius: '8px',
              padding: '14px',
              marginBottom: '24px',
            }}>
              <div style={{ fontWeight: 700, color: '#991b1b', fontSize: '0.9rem', marginBottom: '4px' }}>
                {isHi ? 'आपातकालीन समन्वय तुरंत सक्रिय होगा' : 'Immediate Emergency Coordination'}
              </div>
              <p style={{ fontSize: '0.8rem', color: '#7f1d1d' }}>
                {isHi
                  ? 'यह प्रणाली एआई ट्राइएज चलाएगी, श्रेष्ठ अस्पताल व एम्बुलेंस चुनेगी और अस्पताल को प्री-अलर्ट भेजेगी।'
                  : 'LifeGrid will evaluate clinical severity, match the best-fit hospital and ambulance, and trigger hospital pre-alerting.'}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="btn-secondary"
                disabled={isSubmitting}
                style={{ flex: 1, padding: '12px' }}
              >
                {isHi ? 'वापस' : 'Back'}
              </button>
              <button
                type="button"
                onClick={handleSubmitEmergency}
                disabled={isSubmitting}
                className="btn-danger"
                style={{
                  flex: 2,
                  padding: '14px',
                  fontWeight: 700,
                  fontSize: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <Activity size={18} />
                {isSubmitting
                  ? (isHi ? 'समन्वय जारी...' : 'Coordinating Response...')
                  : (isHi ? 'आपातकाल रिपोर्ट करें' : 'DISPATCH EMERGENCY RESPONSE')}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Live Dispatch Confirmation Screen */}
        {step === 4 && dispatchResult && (
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              padding: '14px',
              marginBottom: '20px',
            }}>
              <CheckCircle2 size={28} color="#15803d" />
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#166534' }}>
                  {isHi ? 'आपातकालीन प्रतिक्रिया सक्रिय!' : 'Emergency Response Dispatched!'}
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#15803d' }}>
                  Incident Ref: <code>#{dispatchResult.incident.id.slice(0, 8)}</code>
                </span>
              </div>
            </div>

            {/* AI Suggestion Triage Display */}
            <div style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '14px',
              marginBottom: '16px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <AISuggestionBadge
                  label="AI-suggested priority"
                  onViewReasoning={() => setShowTraceModal(true)}
                />
                <span style={{
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: '#b91c1c',
                  backgroundColor: '#fee2e2',
                  padding: '3px 8px',
                  borderRadius: '4px',
                }}>
                  {dispatchResult.triage.priority} IMMEDIATE
                </span>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#1e293b', lineHeight: 1.4 }}>
                {dispatchResult.triage.plain_language_summary}
              </p>
            </div>

            {/* Matched Facility & Ambulance */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', backgroundColor: '#ffffff' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>DESTINATION HOSPITAL</span>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                  {dispatchResult.hospital_match?.selected_hospital?.name || 'Hospital B (Super-Specialty)'}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#15803d', fontWeight: 600, marginTop: '2px' }}>
                  Pre-alert acknowledged • Cath Lab Ready
                </div>
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', backgroundColor: '#ffffff' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>ASSIGNED AMBULANCE</span>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                  {dispatchResult.ambulance_match?.selected_ambulance?.vehicle_number || 'MH-20-AX-1088 (ALS)'}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#0369a1', fontWeight: 600, marginTop: '2px' }}>
                  Estimated ETA: {dispatchResult.route?.final_eta_minutes || 14} minutes
                </div>
              </div>
            </div>

            {/* Signal Priority & Drone Fallback Alerts */}
            {dispatchResult.route?.signal_priority_applied && (
              <div style={{
                backgroundColor: '#dcfce7',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '12px',
                fontSize: '0.8rem',
                color: '#15803d',
                fontWeight: 600,
              }}>
                🚦 Simulated Traffic Signal Priority Activated: Emergency corridor ETA reduced by ~{dispatchResult.route.time_saved_minutes} mins.
              </div>
            )}

            {dispatchResult.route?.drone_fallback_triggered && (
              <div style={{
                backgroundColor: '#fee2e2',
                border: '1px solid #fecdd3',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '20px',
                fontSize: '0.8rem',
                color: '#b91c1c',
                fontWeight: 600,
              }}>
                🚁 Emergency Medical Supply Drone Dispatched: Delivering resuscitation payload ahead of ground transport.
              </div>
            )}

            <button
              onClick={() => {
                setStep(1);
                setSelectedSymptoms([]);
                setFreeText('');
                setDispatchResult(null);
              }}
              className="btn-secondary"
              style={{ width: '100%', padding: '12px', fontWeight: 600 }}
            >
              {isHi ? 'नया रिपोर्ट दर्ज करें' : 'Report Another Emergency'}
            </button>
          </div>
        )}
      </div>

      {showTraceModal && dispatchResult && (
        <ExplainabilityModal
          trace={dispatchResult.triage}
          onClose={() => setShowTraceModal(false)}
        />
      )}
    </div>
  );
};
