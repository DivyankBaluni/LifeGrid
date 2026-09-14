// Primary Care Guidance & Routine Triage Screen (Vanilla ES6)
import { evaluateRoutineTriage, createReferral } from '../api.js';
import { renderAISuggestionBadge } from '../components/ai-suggestion-badge.js';
import { openExplainabilityModal } from '../components/explainability-modal.js';

export function createRoutineTriageScreen({ userRole = 'control_center_operator' }) {
  const container = document.createElement('div');
  container.style.cssText = 'max-width: 680px; margin: 0 auto;';

  let symptomText = '';
  let selectedCategory = 'chronic';
  let patientName = 'Kavita Patil';
  let triageResult = null;
  let isSubmitting = false;
  let referralCreated = false;

  const categories = [
    { id: 'maternal', title: 'Maternal & Prenatal Check', desc: 'Antenatal checkup, blood pressure check, fetal movement' },
    { id: 'chronic', title: 'Chronic Illness / Refill', desc: 'Diabetes, hypertension monitoring, regular prescription renewal' },
    { id: 'minor_illness', title: 'Mild Seasonal Illness', desc: 'Mild fever, dry cough, common cold, indigestion' },
    { id: 'skin', title: 'Dermatology & Rash', desc: 'Mild rash, skin itchiness, superficial fungal patch' },
  ];

  const render = () => {
    container.innerHTML = `
      <!-- Calm Institutional Header -->
      <div style="
        background-color: #f1f5f9;
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        padding: 16px 20px;
        margin-bottom: 20px;
      ">
        <div style="display: flex; align-items: center; gap: 10px;">
          <i class="fa-solid fa-stethoscope" style="font-size: 22px; color: #1e40af;"></i>
          <div>
            <h2 style="font-size: 1.15rem; font-weight: 700; color: #0f172a; margin: 0;">
              Primary Care Guidance & Digital Triage
            </h2>
            <p style="font-size: 0.82rem; color: #475569; margin: 4px 0 0 0;">
              Routine continuity module for non-emergency complaints, health worker consultations, and specialist referrals.
            </p>
          </div>
        </div>
      </div>

      <div style="
        background-color: #ffffff;
        border-radius: 12px;
        border: 1px solid #e2e8f0;
        padding: 24px;
        box-shadow: var(--shadow-sm);
      ">
        ${!triageResult ? `
          <form id="routine-form">
            <div style="margin-bottom: 18px;">
              <label style="display: block; font-size: 0.85rem; font-weight: 600; color: #334155; margin-bottom: 6px;">
                Patient Identifier / Name (Optional for anonymous guidance)
              </label>
              <input
                type="text"
                id="routine-patient-name"
                value="${patientName}"
                style="
                  width: 100%;
                  padding: 10px;
                  border-radius: 6px;
                  border: 1px solid #cbd5e1;
                  font-size: 0.9rem;
                "
              />
            </div>

            <div style="margin-bottom: 20px;">
              <label style="display: block; font-size: 0.85rem; font-weight: 600; color: #334155; margin-bottom: 8px;">
                Select Care Category
              </label>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                ${categories.map((cat) => `
                  <div
                    class="js-category-card"
                    data-id="${cat.id}"
                    style="
                      padding: 12px;
                      border-radius: 8px;
                      border: ${selectedCategory === cat.id ? '2px solid #1e40af' : '1px solid #cbd5e1'};
                      background-color: ${selectedCategory === cat.id ? '#eff6ff' : '#ffffff'};
                      cursor: pointer;
                    "
                  >
                    <div style="font-size: 0.88rem; font-weight: 700; color: ${selectedCategory === cat.id ? '#1e40af' : '#0f172a'};">
                      ${cat.title}
                    </div>
                    <div style="font-size: 0.75rem; color: #64748b; margin-top: 4px;">
                      ${cat.desc}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>

            <div style="margin-bottom: 24px;">
              <label style="display: block; font-size: 0.85rem; font-weight: 600; color: #334155; margin-bottom: 6px;">
                Describe Symptoms or Consultation Goal
              </label>
              <textarea
                id="routine-symptoms"
                rows="3"
                placeholder="e.g. Mild headache for 2 days, blood pressure checkup needed, routine diabetes prescription refill."
                style="
                  width: 100%;
                  padding: 10px;
                  border-radius: 8px;
                  border: 1px solid #cbd5e1;
                  font-size: 0.88rem;
                  font-family: inherit;
                "
              >${symptomText}</textarea>
            </div>

            <button
              type="submit"
              class="btn-primary"
              ${isSubmitting ? 'disabled' : ''}
              style="
                width: 100%;
                padding: 12px;
                font-weight: 700;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
              "
            >
              <i class="fa-solid fa-stethoscope"></i>
              ${isSubmitting ? 'Evaluating Clinical Pathway...' : 'Generate Care Recommendation'}
            </button>
          </form>
        ` : `
          <div>
            <div style="
              display: flex;
              align-items: center;
              gap: 10px;
              background-color: #eff6ff;
              border: 1px solid #bfdbfe;
              border-radius: 8px;
              padding: 14px;
              margin-bottom: 20px;
            ">
              <i class="fa-solid fa-circle-check" style="font-size: 24px; color: #1d4ed8;"></i>
              <div>
                <h3 style="font-size: 1rem; font-weight: 700; color: #1e40af; margin: 0;">
                  Care Recommendation Generated
                </h3>
                <span style="font-size: 0.8rem; color: #3b82f6;">
                  Patient: ${patientName} • Rule Engine ID: <code>${triageResult.rule_set_version}</code>
                </span>
              </div>
            </div>

            <!-- AI Suggestion Triage Trace summary -->
            <div style="
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 14px;
              margin-bottom: 20px;
            ">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                ${renderAISuggestionBadge('AI-suggested priority', true, 'view-routine-trace')}
                <span style="
                  font-size: 0.82rem;
                  font-weight: 700;
                  color: #475569;
                  background-color: #f1f5f9;
                  padding: 3px 8px;
                  border-radius: 4px;
                  border: 1px solid #cbd5e1;
                ">
                  ${triageResult.priority} (NON-EMERGENCY)
                </span>
              </div>
              <p style="font-size: 0.88rem; color: #1e293b; line-height: 1.4; margin: 0;">
                ${triageResult.plain_language_summary}
              </p>
            </div>

            <!-- Recommended Routing Options -->
            <h4 style="font-size: 0.9rem; font-weight: 700; color: #334155; margin-bottom: 12px;">
              Suggested Clinical Actions
            </h4>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px;">
              <!-- Option A: Teleconsultation Stub -->
              <div style="
                border: 1px solid #cbd5e1;
                border-radius: 8px;
                padding: 14px;
                background-color: #ffffff;
              ">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                  <i class="fa-solid fa-video" style="font-size: 18px; color: #1e40af;"></i>
                  <strong style="font-size: 0.9rem; color: #0f172a;">Teleconsultation</strong>
                </div>
                <p style="font-size: 0.78rem; color: #64748b; margin-bottom: 12px;">
                  Connect with a remote district medical officer for tele-triage and digital prescription.
                </p>
                <button
                  type="button"
                  id="btn-teleconsult"
                  class="btn-secondary"
                  style="width: 100%; font-size: 0.8rem; padding: 6px;"
                >
                  Start Teleconsult (Demo Stub)
                </button>
              </div>

              <!-- Option B: 3-Tier Referral Initiation -->
              <div style="
                border: 1px solid #cbd5e1;
                border-radius: 8px;
                padding: 14px;
                background-color: #ffffff;
              ">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                  <i class="fa-solid fa-share-nodes" style="font-size: 18px; color: #7e22ce;"></i>
                  <strong style="font-size: 0.9rem; color: #0f172a;">Specialist Referral</strong>
                </div>
                <p style="font-size: 0.78rem; color: #64748b; margin-bottom: 12px;">
                  Initiate formal referral to District Super-Specialty with clinical context payload attached.
                </p>
                ${referralCreated ? `
                  <span style="font-size: 0.8rem; color: #15803d; font-weight: 600;">
                    ✔ Referral Created & Queued
                  </span>
                ` : `
                  <button
                    type="button"
                    id="btn-create-referral"
                    class="btn-primary"
                    style="width: 100%; font-size: 0.8rem; padding: 6px;"
                  >
                    Initiate 3-Tier Referral
                  </button>
                `}
              </div>
            </div>

            <button
              type="button"
              id="btn-new-eval"
              class="btn-secondary"
              style="width: 100%; padding: 10px;"
            >
              Start New Evaluation
            </button>
          </div>
        `}
      </div>
    `;

    bindEvents();
  };

  const bindEvents = () => {
    container.querySelectorAll('.js-category-card').forEach((card) => {
      card.addEventListener('click', () => {
        selectedCategory = card.getAttribute('data-id');
        render();
      });
    });

    const pInput = container.querySelector('#routine-patient-name');
    if (pInput) {
      pInput.addEventListener('input', (e) => {
        patientName = e.target.value;
      });
    }

    const sInput = container.querySelector('#routine-symptoms');
    if (sInput) {
      sInput.addEventListener('input', (e) => {
        symptomText = e.target.value;
      });
    }

    const form = container.querySelector('#routine-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          isSubmitting = true;
          render();
          const res = await evaluateRoutineTriage({
            raw_symptoms: `${selectedCategory}: ${symptomText || 'Routine primary care checkup requested'}`,
            age_band: 'adult',
            known_conditions: ['Hypertension'],
          });
          triageResult = res;
        } catch (err) {
          alert(err.message || 'Failed to evaluate symptoms');
        } finally {
          isSubmitting = false;
          render();
        }
      });
    }

    const teleBtn = container.querySelector('#btn-teleconsult');
    if (teleBtn) {
      teleBtn.addEventListener('click', () => {
        alert('Teleconsultation stub: In production, this initiates a secure video/audio session with Dr. Anita Joshi.');
      });
    }

    const refBtn = container.querySelector('#btn-create-referral');
    if (refBtn) {
      refBtn.addEventListener('click', async () => {
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
          referralCreated = true;
          render();
        } catch (err) {
          alert(err.message || 'Failed to create referral');
        }
      });
    }

    const newEvalBtn = container.querySelector('#btn-new-eval');
    if (newEvalBtn) {
      newEvalBtn.addEventListener('click', () => {
        triageResult = null;
        symptomText = '';
        referralCreated = false;
        render();
      });
    }

    const reasoningBtn = container.querySelector('.js-view-reasoning');
    if (reasoningBtn && triageResult) {
      reasoningBtn.addEventListener('click', () => {
        openExplainabilityModal({ trace: triageResult });
      });
    }
  };

  render();
  return container;
}
