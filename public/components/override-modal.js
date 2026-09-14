// Clinical Override Modal Component (Vanilla ES6)
import { overrideTriage } from '../api.js';

export function openOverrideModal({
  triageId,
  currentPriority = 'P1',
  userRole = 'control_center_operator',
  onClose,
  onSuccess,
}) {
  let selectedPriority = currentPriority;
  let isSubmitting = false;

  const modalEl = document.createElement('div');
  modalEl.className = 'modal-overlay';
  modalEl.id = 'override-modal';

  const renderContent = (errorMsg = null) => {
    modalEl.innerHTML = `
      <div class="modal-content" style="max-width: 520px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-user-check" style="font-size: 20px; color: #7e22ce;"></i>
            <h3 style="font-size: 1.2rem; font-weight: 700; color: #0f172a; margin: 0;">
              Clinical Triage Override
            </h3>
          </div>
          <button type="button" class="js-close-modal" style="background: none; border: none; cursor: pointer; color: #64748b; font-size: 18px;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <p style="font-size: 0.85rem; color: #475569; margin-bottom: 16px;">
          As an authorized healthcare provider or control-center operator, you may override the AI-suggested triage level.
          This decision will be appended to the immutable audit trail along with your clinical rationale.
        </p>

        ${errorMsg ? `
          <div style="
            background-color: #fef2f2;
            border: 1px solid #fee2e2;
            color: #b91c1c;
            padding: 10px;
            border-radius: 6px;
            font-size: 0.85rem;
            margin-bottom: 14px;
            display: flex;
            align-items: center;
            gap: 8px;
          ">
            <i class="fa-solid fa-circle-exclamation"></i>
            ${errorMsg}
          </div>
        ` : ''}

        <form id="override-form">
          <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 0.85rem; font-weight: 600; color: #334155; margin-bottom: 6px;">
              New Priority Level
            </label>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
              ${['P1', 'P2', 'P3', 'P4'].map((p) => `
                <button
                  type="button"
                  class="js-priority-btn"
                  data-priority="${p}"
                  style="
                    padding: 8px 12px;
                    border-radius: 6px;
                    font-weight: 700;
                    border: ${selectedPriority === p ? '2px solid #1e40af' : '1px solid #cbd5e1'};
                    background-color: ${selectedPriority === p ? '#eff6ff' : '#ffffff'};
                    color: ${selectedPriority === p ? '#1e40af' : '#475569'};
                    cursor: pointer;
                  "
                >
                  ${p}
                </button>
              `).join('')}
            </div>
          </div>

          <div style="margin-bottom: 20px;">
            <label style="display: block; font-size: 0.85rem; font-weight: 600; color: #334155; margin-bottom: 6px;">
              Clinical Rationale (Mandatory)
            </label>
            <textarea
              id="override-reason"
              rows="3"
              placeholder="e.g. Patient showed signs of neurovascular stability on-scene after splint application, downgrading P1 to P2."
              style="
                width: 100%;
                padding: 10px;
                border-radius: 6px;
                border: 1px solid #cbd5e1;
                font-size: 0.85rem;
                font-family: inherit;
                resize: vertical;
              "
            ></textarea>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button type="button" class="btn-secondary js-close-modal" ${isSubmitting ? 'disabled' : ''}>
              Cancel
            </button>
            <button type="submit" class="btn-primary" id="override-submit-btn" ${isSubmitting ? 'disabled' : ''}>
              ${isSubmitting ? 'Recording Override...' : 'Confirm & Log Override'}
            </button>
          </div>
        </form>
      </div>
    `;

    bindEvents();
  };

  const close = () => {
    modalEl.remove();
    document.removeEventListener('keydown', handleKey);
    if (onClose) onClose();
  };

  const handleKey = (e) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', handleKey);

  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) close();
  });

  const bindEvents = () => {
    modalEl.querySelectorAll('.js-close-modal').forEach((b) => b.addEventListener('click', close));

    modalEl.querySelectorAll('.js-priority-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedPriority = btn.getAttribute('data-priority');
        modalEl.querySelectorAll('.js-priority-btn').forEach((b) => {
          const isSel = b.getAttribute('data-priority') === selectedPriority;
          b.style.border = isSel ? '2px solid #1e40af' : '1px solid #cbd5e1';
          b.style.backgroundColor = isSel ? '#eff6ff' : '#ffffff';
          b.style.color = isSel ? '#1e40af' : '#475569';
        });
      });
    });

    const form = modalEl.querySelector('#override-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const reasonInput = modalEl.querySelector('#override-reason');
        const reason = reasonInput ? reasonInput.value.trim() : '';

        if (!reason || reason.length < 5) {
          renderContent('A mandatory clinical rationale (at least 5 characters) is required to override an AI triage decision.');
          return;
        }

        try {
          isSubmitting = true;
          const submitBtn = modalEl.querySelector('#override-submit-btn');
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Recording Override...';
          }
          const updated = await overrideTriage(triageId, selectedPriority, reason, userRole);
          close();
          if (onSuccess) onSuccess(updated);
        } catch (err) {
          isSubmitting = false;
          renderContent(err.message || 'Failed to submit override');
        }
      });
    }
  };

  renderContent();
  document.body.appendChild(modalEl);
}
