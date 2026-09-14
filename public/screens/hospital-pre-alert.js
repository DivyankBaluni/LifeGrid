// Hospital Pre-Alert Console Screen (Vanilla ES6)
import { getHospitalAlerts, acknowledgeAlert, fetchIncidentById } from '../api.js';
import { TriageBadge } from '../components/badges.js';
import { renderAISuggestionBadge } from '../components/ai-suggestion-badge.js';
import { openExplainabilityModal } from '../components/explainability-modal.js';

export function createHospitalPreAlertScreen({ hospitalId = 'hosp-b-district' }) {
  const container = document.createElement('div');
  container.style.cssText = 'max-width: 800px; margin: 0 auto;';

  let alerts = [];
  let selectedAlert = null;
  let checklist = {
    bed_confirmed: false,
    specialist_confirmed: false,
    equipment_confirmed: false,
  };
  let isAcking = false;

  const render = () => {
    container.innerHTML = `
      <!-- Hospital Banner -->
      <div style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        background-color: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 16px 20px;
        margin-bottom: 20px;
        box-shadow: var(--shadow-sm);
      ">
        <div style="display: flex; align-items: center; gap: 12px;">
          <i class="fa-solid fa-building" style="font-size: 24px; color: #1e40af;"></i>
          <div>
            <h2 style="font-size: 1.15rem; font-weight: 700; color: #0f172a; margin: 0;">
              District Super-Specialty Medical Centre (Hospital B)
            </h2>
            <div style="font-size: 0.8rem; color: #64748b; margin-top: 2px;">
              Trauma & Emergency Department Receiving Console • 12/40 Beds Available
            </div>
          </div>
        </div>

        <button
          type="button"
          id="btn-refresh-alerts"
          class="btn-secondary"
          style="display: flex; align-items: center; gap: 6px; font-size: 0.8rem; padding: 6px 12px;"
        >
          <i class="fa-solid fa-rotate"></i>
          Refresh
        </button>
      </div>

      ${alerts.length === 0 ? `
        <div style="
          background-color: #ffffff;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          padding: 40px;
          text-align: center;
          color: #64748b;
        ">
          <i class="fa-solid fa-circle-check" style="font-size: 36px; color: #15803d; margin: 0 auto 12px; display: block;"></i>
          <h3 style="font-size: 1.1rem; font-weight: 700; color: #0f172a; margin: 0;">No Incoming Pre-Alerts</h3>
          <p style="font-size: 0.85rem; color: #64748b; margin: 4px 0 0 0;">
            All incoming emergency cases have been received and admitted. Standing by for regional dispatches.
          </p>
        </div>
      ` : `
        <div style="
          background-color: #ffffff;
          border-radius: 12px;
          border: 2px solid #b91c1c;
          overflow: hidden;
          box-shadow: var(--shadow-md);
        ">
          <!-- Urgent Incoming Header -->
          <div style="
            background-color: #fee2e2;
            border-bottom: 1px solid #fecdd3;
            padding: 16px 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
          ">
            <div style="display: flex; align-items: center; gap: 10px;">
              <i class="fa-solid fa-bell" style="font-size: 22px; color: #b91c1c;"></i>
              <div>
                <span style="font-size: 0.75rem; font-weight: 700; color: #991b1b; text-transform: uppercase;">
                  URGENT INCOMING PRE-ALERT
                </span>
                <div style="font-size: 1.2rem; font-weight: 700; color: #7f1d1d;">
                  Trauma / Cardiac Resuscitation Required
                </div>
              </div>
            </div>

            <!-- Big ETA Countdown Display -->
            <div style="
              background-color: #b91c1c;
              color: #ffffff;
              border-radius: 8px;
              padding: 8px 16px;
              textAlign: center;
            ">
              <div style="font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;">
                ESTIMATED ETA
              </div>
              <div style="font-size: 1.6rem; font-weight: 800; font-family: monospace; line-height: 1.1;">
                ~${selectedAlert?.eta_minutes || 14} MIN
              </div>
            </div>
          </div>

          <!-- Patient Details & AI Suggestion -->
          <div style="padding: 20px;">
            <div style="
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
              gap: 14px;
              margin-bottom: 20px;
            ">
              <div style="background-color: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
                <span style="font-size: 0.75rem; font-weight: 700; color: #64748b;">TRIAGE PRIORITY</span>
                <div style="margin-top: 4px;">
                  ${TriageBadge('P1')}
                </div>
                <div style="margin-top: 8px;">
                  ${renderAISuggestionBadge('AI-suggested priority', true, 'view-prealert-trace')}
                </div>
              </div>

              <div style="background-color: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
                <span style="font-size: 0.75rem; font-weight: 700; color: #64748b;">PATIENT PROFILE</span>
                <div style="font-size: 0.95rem; font-weight: 700; color: #0f172a; margin-top: 4px;">
                  Bhagwanrao Deshmukh (68 yrs)
                </div>
                <div style="font-size: 0.78rem; color: #64748b; margin-top: 2px;">
                  Known history of Hypertension & Angina
                </div>
              </div>

              <div style="background-color: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
                <span style="font-size: 0.75rem; font-weight: 700; color: #64748b;">REPORTED SYMPTOMS</span>
                <div style="font-size: 0.85rem; color: #1e293b; font-weight: 600; margin-top: 4px;">
                  Crushing chest pain, radiating arm pain, profuse sweating
                </div>
              </div>
            </div>

            <!-- Readiness Checklist -->
            <div style="
              border: 1.5px solid #cbd5e1;
              border-radius: 10px;
              padding: 16px;
              background-color: #f8fafc;
              margin-bottom: 20px;
            ">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                <h4 style="font-size: 0.95rem; font-weight: 700; color: #0f172a; margin: 0;">
                  Facility Readiness Checklist
                </h4>
                <span style="font-size: 0.75rem; color: #64748b;">
                  ${selectedAlert?.status === 'acknowledged' ? 'Status: Confirmed Ready' : 'Pending Confirmation'}
                </span>
              </div>

              <div style="display: flex; flex-direction: column; gap: 10px;">
                <div
                  id="chk-bed"
                  class="js-check-row"
                  style="
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 14px;
                    border-radius: 6px;
                    background-color: #ffffff;
                    border: 1px solid #cbd5e1;
                    cursor: pointer;
                  "
                >
                  <i class="fa-solid ${checklist.bed_confirmed ? 'fa-square-check' : 'fa-square'}" style="font-size: 20px; color: ${checklist.bed_confirmed ? '#15803d' : '#94a3b8'};"></i>
                  <div style="font-size: 0.88rem; font-weight: 600; color: #1e293b;">
                    1. Cardiac Resuscitation ICU Bed Reserved (Bay 3 confirmed)
                  </div>
                </div>

                <div
                  id="chk-specialist"
                  class="js-check-row"
                  style="
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 14px;
                    border-radius: 6px;
                    background-color: #ffffff;
                    border: 1px solid #cbd5e1;
                    cursor: pointer;
                  "
                >
                  <i class="fa-solid ${checklist.specialist_confirmed ? 'fa-square-check' : 'fa-square'}" style="font-size: 20px; color: ${checklist.specialist_confirmed ? '#15803d' : '#94a3b8'};"></i>
                  <div style="font-size: 0.88rem; font-weight: 600; color: #1e293b;">
                    2. On-call Cardiologist (Dr. Anita Joshi) Notified & scrubbed
                  </div>
                </div>

                <div
                  id="chk-equipment"
                  class="js-check-row"
                  style="
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 14px;
                    border-radius: 6px;
                    background-color: #ffffff;
                    border: 1px solid #cbd5e1;
                    cursor: pointer;
                  "
                >
                  <i class="fa-solid ${checklist.equipment_confirmed ? 'fa-square-check' : 'fa-square'}" style="font-size: 20px; color: ${checklist.equipment_confirmed ? '#15803d' : '#94a3b8'};"></i>
                  <div style="font-size: 0.88rem; font-weight: 600; color: #1e293b;">
                    3. Cath Lab & Defibrillator Powered & Ready for Transfer
                  </div>
                </div>
              </div>
            </div>

            <!-- Acknowledgment Action Button -->
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div style="font-size: 0.8rem; color: #64748b;">
                Acknowledging pre-alert transmits immediate readiness signal to ambulance EMT & Control Center.
              </div>
              <button
                type="button"
                id="btn-ack-alert"
                class="btn-primary"
                ${isAcking || selectedAlert?.status === 'acknowledged' ? 'disabled' : ''}
                style="
                  padding: 12px 24px;
                  font-weight: 700;
                  font-size: 0.95rem;
                  background-color: ${selectedAlert?.status === 'acknowledged' ? '#15803d' : '#1e40af'};
                "
              >
                ${selectedAlert?.status === 'acknowledged'
                  ? '✔ PRE-ALERT ACKNOWLEDGED'
                  : isAcking
                  ? 'Transmitting...'
                  : 'Acknowledge Ready'}
              </button>
            </div>
          </div>
        </div>
      `}
    `;

    bindEvents();
  };

  const bindEvents = () => {
    const refreshBtn = container.querySelector('#btn-refresh-alerts');
    if (refreshBtn) refreshBtn.addEventListener('click', loadAlerts);

    const chkBed = container.querySelector('#chk-bed');
    if (chkBed) {
      chkBed.addEventListener('click', () => {
        checklist.bed_confirmed = !checklist.bed_confirmed;
        render();
      });
    }

    const chkSpec = container.querySelector('#chk-specialist');
    if (chkSpec) {
      chkSpec.addEventListener('click', () => {
        checklist.specialist_confirmed = !checklist.specialist_confirmed;
        render();
      });
    }

    const chkEq = container.querySelector('#chk-equipment');
    if (chkEq) {
      chkEq.addEventListener('click', () => {
        checklist.equipment_confirmed = !checklist.equipment_confirmed;
        render();
      });
    }

    const ackBtn = container.querySelector('#btn-ack-alert');
    if (ackBtn && selectedAlert) {
      ackBtn.addEventListener('click', async () => {
        try {
          isAcking = true;
          render();
          const updated = await acknowledgeAlert(selectedAlert.id, checklist);
          selectedAlert = updated;
          await loadAlerts();
        } catch (err) {
          alert(err.message || 'Failed to acknowledge alert');
        } finally {
          isAcking = false;
          render();
        }
      });
    }

    const reasoningBtn = container.querySelector('.js-view-reasoning');
    if (reasoningBtn && selectedAlert) {
      reasoningBtn.addEventListener('click', async () => {
        try {
          const incData = await fetchIncidentById(selectedAlert.incident_id);
          openExplainabilityModal({ trace: incData.triage_trace });
        } catch (e) {
          console.error(e);
        }
      });
    }
  };

  const loadAlerts = async () => {
    try {
      const data = await getHospitalAlerts(hospitalId);
      alerts = data || [];
      if (alerts.length > 0 && !selectedAlert) {
        selectedAlert = alerts[0];
        checklist = {
          bed_confirmed: alerts[0].readiness_checklist?.bed_confirmed || false,
          specialist_confirmed: alerts[0].readiness_checklist?.specialist_confirmed || false,
          equipment_confirmed: alerts[0].readiness_checklist?.equipment_confirmed || false,
        };
      }
      render();
    } catch (err) {
      console.error('Failed to load hospital alerts', err);
    }
  };

  loadAlerts();
  const pollInterval = setInterval(loadAlerts, 5000);

  return {
    element: container,
    destroy() {
      clearInterval(pollInterval);
    },
  };
}
