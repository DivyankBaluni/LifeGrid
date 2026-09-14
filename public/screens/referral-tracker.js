// 3-Tier Referral Tracker Screen (Vanilla ES6)
import { updateReferralStatus } from '../api.js';

export function createReferralTrackerScreen({ referrals = [], onRefresh, userRole = 'control_center_operator' }) {
  const container = document.createElement('div');
  container.style.cssText = 'max-width: 900px; margin: 0 auto;';

  let currentReferrals = referrals;
  let selectedReferral = currentReferrals[0] || null;
  let isUpdating = false;

  const steps = [
    { key: 'initiated', label: '1. Initiated at PHC', desc: 'Primary evaluation & stabilization' },
    { key: 'in_transit', label: '2. In Transit / Transport', desc: 'Patient en route to higher tier' },
    { key: 'received', label: '3. Received at District', desc: 'Carried-forward context verified' },
    { key: 'completed', label: '4. Case Completed', desc: 'Specialist care delivered' },
  ];

  const getStepIndex = (status) => {
    switch (status) {
      case 'initiated': return 0;
      case 'in_transit': return 1;
      case 'received': return 2;
      case 'completed': return 3;
      default: return 0;
    }
  };

  const render = () => {
    container.innerHTML = `
      <!-- Header -->
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
        <div style="display: flex; align-items: center; gap: 10px;">
          <i class="fa-solid fa-share-nodes" style="font-size: 24px; color: #7e22ce;"></i>
          <div>
            <h2 style="font-size: 1.15rem; font-weight: 700; color: #0f172a; margin: 0;">
              3-Tier Rural Healthcare Referral & Continuity Tracker
            </h2>
            <div style="font-size: 0.8rem; color: #64748b; margin-top: 2px;">
              Sub-Centre / PHC ➔ Rural Hospital ➔ District Super-Specialty (Continuity of Clinical Record)
            </div>
          </div>
        </div>
      </div>

      ${currentReferrals.length === 0 ? `
        <div style="padding: 40px; background-color: #ffffff; text-align: center; border-radius: 12px; border: 1px solid #e2e8f0;">
          No active referrals. Seed the demo scenario or create one in the Routine Care tab.
        </div>
      ` : `
        <div style="display: grid; grid-template-columns: minmax(280px, 1fr) 2fr; gap: 16px;">
          <!-- Referral List -->
          <div style="
            background-color: #ffffff;
            border-radius: 10px;
            border: 1px solid #e2e8f0;
            overflow: hidden;
          ">
            <div style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 700; font-size: 0.85rem;">
              Active Referral Records (${currentReferrals.length})
            </div>
            <div style="max-height: 500px; overflow-y: auto;">
              ${currentReferrals.map((r) => {
                const isSelected = selectedReferral && selectedReferral.id === r.id;
                return `
                  <div
                    class="js-referral-item"
                    data-id="${r.id}"
                    style="
                      padding: 12px 14px;
                      border-bottom: 1px solid #f1f5f9;
                      cursor: pointer;
                      background-color: ${isSelected ? '#faf5ff' : '#ffffff'};
                      border-left: ${isSelected ? '4px solid #7e22ce' : '4px solid transparent'};
                    "
                  >
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                      <strong style="font-size: 0.88rem; color: #0f172a;">
                        ${r.patient_name || 'Patient'}
                      </strong>
                      <span style="
                        font-size: 0.72rem;
                        font-weight: 700;
                        text-transform: uppercase;
                        color: #7e22ce;
                        background-color: #fae8ff;
                        padding: 2px 6px;
                        border-radius: 4px;
                      ">
                        ${r.status}
                      </span>
                    </div>
                    <div style="font-size: 0.8rem; color: #475569; line-height: 1.3;">
                      ${r.reason}
                    </div>
                    <div style="font-size: 0.72rem; color: #94a3b8; margin-top: 4px;">
                      ${new Date(r.created_at).toLocaleDateString()}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Stepper Timeline & Carried-Forward Context -->
          ${selectedReferral ? `
            <div style="
              background-color: #ffffff;
              border-radius: 10px;
              border: 1px solid #e2e8f0;
              padding: 20px;
              display: flex;
              flex-direction: column;
              gap: 20px;
            ">
              <!-- Stepper Timeline -->
              <div>
                <span style="font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase;">
                  REFERRAL CHAIN PROGRESSION
                </span>
                <div style="
                  display: grid;
                  grid-template-columns: repeat(4, 1fr);
                  gap: 8px;
                  margin-top: 10px;
                ">
                  ${steps.map((st, idx) => {
                    const currentIdx = getStepIndex(selectedReferral.status);
                    const isDone = idx < currentIdx;
                    const isCurrent = idx === currentIdx;

                    return `
                      <div style="
                        border: ${isCurrent ? '2px solid #7e22ce' : '1px solid #e2e8f0'};
                        background-color: ${isCurrent ? '#faf5ff' : isDone ? '#f0fdf4' : '#f8fafc'};
                        border-radius: 8px;
                        padding: 10px;
                        text-align: center;
                      ">
                        <div style="
                          font-size: 0.75rem;
                          font-weight: 700;
                          color: ${isCurrent ? '#7e22ce' : isDone ? '#15803d' : '#64748b'};
                          margin-bottom: 4px;
                        ">
                          ${isDone ? '✔ ' : ''}${st.label}
                        </div>
                        <div style="font-size: 0.68rem; color: #64748b;">
                          ${st.desc}
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>

              <!-- Carried Forward Clinical Context Payload -->
              <div style="
                border: 1.5px solid #d8b4fe;
                border-radius: 8px;
                background-color: #faf5ff;
                padding: 16px;
              ">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                  <i class="fa-solid fa-heart-pulse" style="font-size: 18px; color: #7e22ce;"></i>
                  <strong style="font-size: 0.9rem; color: #581c87;">
                    Carried-Forward Clinical Context (No Patient Re-interviewing)
                  </strong>
                </div>

                <div style="font-size: 0.85rem; color: #3b0764; display: flex; flexDirection: column; gap: 8px;">
                  <div>
                    <strong>Initial PHC Findings:</strong> ${selectedReferral.context_payload?.initial_findings || 'Standard assessment'}
                  </div>
                  <div>
                    <strong>Triage Summary:</strong> ${selectedReferral.context_payload?.triage_summary || 'P2 Urgent'}
                  </div>
                  ${selectedReferral.context_payload?.vital_signs ? `
                    <div style="
                      display: flex;
                      gap: 12px;
                      background-color: #ffffff;
                      padding: 8px 12px;
                      border-radius: 6px;
                      border: 1px solid #e9d5ff;
                      font-weight: 600;
                    ">
                      <span>BP: ${selectedReferral.context_payload.vital_signs.bp || '120/80'}</span>
                      <span>Pulse: ${selectedReferral.context_payload.vital_signs.pulse || '76'} bpm</span>
                      <span>SpO2: ${selectedReferral.context_payload.vital_signs.spo2 || '98'}%</span>
                    </div>
                  ` : ''}
                  <div>
                    <strong>Interventions Administered at Source:</strong>
                    ${(selectedReferral.context_payload?.interventions_given || []).join(', ') || 'None recorded'}
                  </div>
                  <div>
                    <strong>Clinical Notes:</strong> ${selectedReferral.context_payload?.notes || 'Direct referral upward'}
                  </div>
                </div>
              </div>

              <!-- Status Action Buttons -->
              <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid #e2e8f0; padding-top: 14px;">
                ${selectedReferral.status === 'initiated' ? `
                  <button
                    type="button"
                    class="btn-primary js-status-change"
                    data-status="in_transit"
                    ${isUpdating ? 'disabled' : ''}
                    style="background-color: #7e22ce; font-size: 0.85rem;"
                  >
                    Mark as In-Transit (Dispatched)
                  </button>
                ` : ''}
                ${selectedReferral.status === 'in_transit' ? `
                  <button
                    type="button"
                    class="btn-primary js-status-change"
                    data-status="received"
                    ${isUpdating ? 'disabled' : ''}
                    style="background-color: #15803d; font-size: 0.85rem;"
                  >
                    Confirm Patient Received at Hospital
                  </button>
                ` : ''}
                ${selectedReferral.status === 'received' ? `
                  <button
                    type="button"
                    class="btn-primary js-status-change"
                    data-status="completed"
                    ${isUpdating ? 'disabled' : ''}
                    style="background-color: #0f172a; font-size: 0.85rem;"
                  >
                    Mark Clinical Case Completed
                  </button>
                ` : ''}
              </div>
            </div>
          ` : ''}
        </div>
      `}
    `;

    bindEvents();
  };

  const bindEvents = () => {
    container.querySelectorAll('.js-referral-item').forEach((item) => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-id');
        selectedReferral = currentReferrals.find((r) => r.id === id) || null;
        render();
      });
    });

    const statusBtn = container.querySelector('.js-status-change');
    if (statusBtn && selectedReferral) {
      statusBtn.addEventListener('click', async () => {
        const nextStatus = statusBtn.getAttribute('data-status');
        try {
          isUpdating = true;
          render();
          await updateReferralStatus(selectedReferral.id, nextStatus);
          selectedReferral.status = nextStatus;
          if (onRefresh) onRefresh();
        } catch (err) {
          alert(err.message || 'Failed to update referral');
        } finally {
          isUpdating = false;
          render();
        }
      });
    }
  };

  render();

  return {
    element: container,
    update(newReferrals) {
      currentReferrals = newReferrals || [];
      if (selectedReferral) {
        selectedReferral = currentReferrals.find((r) => r.id === selectedReferral.id) || currentReferrals[0] || null;
      } else {
        selectedReferral = currentReferrals[0] || null;
      }
      render();
    },
  };
}
