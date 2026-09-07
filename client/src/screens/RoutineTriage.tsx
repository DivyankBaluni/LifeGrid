import React, { useState } from 'react';
import {
  Stethoscope,
  CheckCircle,
  Video,
  Share2,
} from 'lucide-react';
import { evaluateRoutineTriage, createReferral } from '../api/client';
import { AISuggestionBadge } from '../components/AISuggestionBadge';
import { ExplainabilityModal } from '../components/ExplainabilityModal';

export const RoutineTriage: React.FC<{ userRole?: string }> = () => {
  const [symptomText, setSymptomText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('chronic');
  const [patientName, setPatientName] = useState('Kavita Patil');
  const [triageResult, setTriageResult] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTrace, setShowTrace] = useState(false);
  const [referralCreated, setReferralCreated] = useState(false);

  const categories = [
    { id: 'maternal', title: 'Maternal & Prenatal Check', desc: 'Antenatal checkup, blood pressure check, fetal movement' },
    { id: 'chronic', title: 'Chronic Illness / Refill', desc: 'Diabetes, hypertension monitoring, regular prescription renewal' },
    { id: 'minor_illness', title: 'Mild Seasonal Illness', desc: 'Mild fever, dry cough, common cold, indigestion' },
    { id: 'skin', title: 'Dermatology & Rash', desc: 'Mild rash, skin itchiness, superficial fungal patch' },
  ];

  const handleEvaluate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const res = await evaluateRoutineTriage({
        raw_symptoms: `${selectedCategory}: ${symptomText || 'Routine primary care checkup requested'}`,
        age_band: 'adult',
        known_conditions: ['Hypertension'],
      });
      setTriageResult(res);
    } catch (err: any) {
      alert(err.message || 'Failed to evaluate symptoms');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInitiateReferral = async () => {
    try {
      await createReferral({
        patient_id: 'pat-maternal-01',
        from_facility_id: 'hosp-phc-rampur',
        to_facility_id: 'hosp-b-district',
        reason: `Routine evaluation flagged: ${symptomText || 'Elevated blood pressure in prenatal checkup'}`,
        triage_result_id: triageResult?.triage_id,
        context_payload: {
          prior_symptoms: symptomText || 'Routine monitoring',
          triage_summary: triageResult?.plain_language_summary || 'P4 Routine Guidance',
          initial_findings: 'Assessed at PHC Rampur; stable vitals, regular follow-up required.',
          vital_signs: { bp: '130/85', pulse: 76, spo2: 99, temp: 36.8 },
          interventions_given: ['Dietary counsel', 'Routine iron & calcium supplements dispensed'],
          referral_urgency: triageResult?.priority || 'P4',
          notes: 'Continuity payload carried forward to District Hospital clinic.',
        },
      });
      setReferralCreated(true);
    } catch (err: any) {
      alert(err.message || 'Failed to create referral');
    }
  };

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto' }}>
      {/* Calm Institutional Header */}
      <div style={{
        backgroundColor: '#f1f5f9',
        border: '1px solid #cbd5e1',
        borderRadius: '10px',
        padding: '16px 20px',
        marginBottom: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Stethoscope size={22} color="#1e40af" />
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
              Primary Care Guidance & Digital Triage
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#475569' }}>
              Routine continuity module for non-emergency complaints, health worker consultations, and specialist referrals.
            </p>
          </div>
        </div>
      </div>

      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        padding: '24px',
        boxShadow: 'var(--shadow-sm)',
      }}>
        {!triageResult ? (
          <form onSubmit={handleEvaluate}>
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Patient Identifier / Name (Optional for anonymous guidance)
              </label>
              <input
                type="text"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.9rem',
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                Select Care Category
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      border: selectedCategory === cat.id ? '2px solid #1e40af' : '1px solid #cbd5e1',
                      backgroundColor: selectedCategory === cat.id ? '#eff6ff' : '#ffffff',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: selectedCategory === cat.id ? '#1e40af' : '#0f172a' }}>
                      {cat.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                      {cat.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Describe Symptoms or Consultation Goal
              </label>
              <textarea
                rows={3}
                value={symptomText}
                onChange={(e) => setSymptomText(e.target.value)}
                placeholder="e.g. Mild headache for 2 days, blood pressure checkup needed, routine diabetes prescription refill."
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.88rem',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '12px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Stethoscope size={18} />
              {isSubmitting ? 'Evaluating Clinical Pathway...' : 'Generate Care Recommendation'}
            </button>
          </form>
        ) : (
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '8px',
              padding: '14px',
              marginBottom: '20px',
            }}>
              <CheckCircle size={24} color="#1d4ed8" />
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e40af' }}>
                  Care Recommendation Generated
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#3b82f6' }}>
                  Patient: {patientName} • Rule Engine ID: <code>{triageResult.rule_set_version}</code>
                </span>
              </div>
            </div>

            {/* AI Suggestion Triage Trace summary */}
            <div style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '14px',
              marginBottom: '20px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <AISuggestionBadge
                  label="AI-suggested priority"
                  onViewReasoning={() => setShowTrace(true)}
                />
                <span style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: '#475569',
                  backgroundColor: '#f1f5f9',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                }}>
                  {triageResult.priority} (NON-EMERGENCY)
                </span>
              </div>
              <p style={{ fontSize: '0.88rem', color: '#1e293b', lineHeight: 1.4 }}>
                {triageResult.plain_language_summary}
              </p>
            </div>

            {/* Recommended Routing Options */}
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155', marginBottom: '12px' }}>
              Suggested Clinical Actions
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
              {/* Option A: Teleconsultation Stub */}
              <div style={{
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '14px',
                backgroundColor: '#ffffff',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <Video size={18} color="#1e40af" />
                  <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>Teleconsultation</strong>
                </div>
                <p style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '12px' }}>
                  Connect with a remote district medical officer for tele-triage and digital prescription.
                </p>
                <button
                  type="button"
                  onClick={() => alert('Teleconsultation stub: In production, this initiates a secure video/audio session with Dr. Anita Joshi.')}
                  className="btn-secondary"
                  style={{ width: '100%', fontSize: '0.8rem', padding: '6px' }}
                >
                  Start Teleconsult (Demo Stub)
                </button>
              </div>

              {/* Option B: 3-Tier Referral Initiation */}
              <div style={{
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '14px',
                backgroundColor: '#ffffff',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <Share2 size={18} color="#7e22ce" />
                  <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>Specialist Referral</strong>
                </div>
                <p style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '12px' }}>
                  Initiate formal referral to District Super-Specialty with clinical context payload attached.
                </p>
                {referralCreated ? (
                  <span style={{ fontSize: '0.8rem', color: '#15803d', fontWeight: 600 }}>
                    ✔ Referral Created & Queued
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleInitiateReferral}
                    className="btn-primary"
                    style={{ width: '100%', fontSize: '0.8rem', padding: '6px' }}
                  >
                    Initiate 3-Tier Referral
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={() => {
                setTriageResult(null);
                setSymptomText('');
                setReferralCreated(false);
              }}
              className="btn-secondary"
              style={{ width: '100%', padding: '10px' }}
            >
              Start New Evaluation
            </button>
          </div>
        )}
      </div>

      {showTrace && (
        <ExplainabilityModal
          trace={triageResult}
          onClose={() => setShowTrace(false)}
        />
      )}
    </div>
  );
};
