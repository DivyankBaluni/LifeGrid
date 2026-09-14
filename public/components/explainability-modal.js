// Explainability Modal Component (Vanilla ES6)

export function openExplainabilityModal({ trace, onClose, onOpenOverride, canOverride = false }) {
  if (!trace) return;

  const isHospitalMatch = trace.target_type === 'hospital';
  const isAmbulanceMatch = trace.target_type === 'ambulance';

  const modalEl = document.createElement('div');
  modalEl.className = 'modal-overlay';
  modalEl.id = 'explainability-modal';

  const title = isHospitalMatch
    ? 'Hospital Match Decision Trace'
    : isAmbulanceMatch
    ? 'Ambulance Dispatch Decision Trace'
    : 'AI Triage Explainability Trace';

  const confidenceHtml = trace.confidence_flags ? `
    <div style="display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap;">
      ${trace.confidence_flags.incomplete_input ? `
        <span style="
          background-color: #fff7ed;
          color: #c2410c;
          border: 1px solid #ffedd5;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 0.8rem;
          display: flex;
          align-items: center;
          gap: 6px;
        ">
          <i class="fa-solid fa-triangle-exclamation"></i>
          Incomplete Input Flagged
        </span>
      ` : ''}
      ${trace.confidence_flags.conflicting_input ? `
        <span style="
          background-color: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fee2e2;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 0.8rem;
          display: flex;
          align-items: center;
          gap: 6px;
        ">
          <i class="fa-solid fa-triangle-exclamation"></i>
          Conflicting Signals — Defaulted to High Urgency (Safe Failure)
        </span>
      ` : ''}
      ${!trace.confidence_flags.incomplete_input && !trace.confidence_flags.conflicting_input ? `
        <span style="
          background-color: #f0fdf4;
          color: #15803d;
          border: 1px solid #dcfce7;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 0.8rem;
          display: flex;
          align-items: center;
          gap: 6px;
        ">
          <i class="fa-solid fa-circle-check"></i>
          Confidence Check Passed (Consistent Input)
        </span>
      ` : ''}
    </div>
  ` : '';

  const signalsHtml = trace.signals_fired && trace.signals_fired.length > 0 ? `
    <div style="margin-bottom: 20px;">
      <h4 style="font-size: 0.9rem; fontWeight: 700; color: #1e293b; margin-bottom: 10px;">
        Fired Clinical Signals (${trace.signals_fired.length})
      </h4>
      <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
          <thead style="background-color: #f1f5f9; text-align: left;">
            <tr>
              <th style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">Rule ID</th>
              <th style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">Clinical Reason</th>
              <th style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; width: 80px;">Weight</th>
            </tr>
          </thead>
          <tbody>
            ${trace.signals_fired.map((sig) => `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 12px; font-family: monospace; font-weight: 600; color: #334155;">
                  ${sig.rule}
                </td>
                <td style="padding: 8px 12px; color: #1e293b;">${sig.reason}</td>
                <td style="padding: 8px 12px; font-weight: 600; color: #0f172a;">${sig.weight}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  ` : '';

  const candidatesHtml = trace.candidate_evaluations && trace.candidate_evaluations.length > 0 ? `
    <div style="margin-bottom: 20px;">
      <h4 style="font-size: 0.9rem; font-weight: 700; color: #1e293b; margin-bottom: 10px;">
        Candidate Facility Scoring ("Best fit, not nearest")
      </h4>
      <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
          <thead style="background-color: #f1f5f9; text-align: left;">
            <tr>
              <th style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">Facility</th>
              <th style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">Distance / ETA</th>
              <th style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">Capability Match</th>
              <th style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">Total Score</th>
            </tr>
          </thead>
          <tbody>
            ${trace.candidate_evaluations.map((cand) => `
              <tr style="background-color: ${cand.id === trace.selected_id ? '#f0fdf4' : 'transparent'}; border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 12px; font-weight: 600;">
                  ${cand.name}
                  ${cand.id === trace.selected_id ? `
                    <span style="margin-left: 6px; font-size: 0.75rem; color: #15803d; font-weight: 700;">
                      (SELECTED)
                    </span>
                  ` : ''}
                  ${cand.capped_due_to_missing_required_tag ? `
                    <div style="font-size: 0.75rem; color: #b91c1c; font-weight: 500;">
                      Capped: Lacks required capability [${(cand.missing_tags || []).join(', ')}]
                    </div>
                  ` : ''}
                </td>
                <td style="padding: 8px 12px;">
                  ${cand.distance_km} km (${cand.eta_minutes} min)
                </td>
                <td style="padding: 8px 12px;">
                  <span style="color: ${cand.capability_match >= 0.8 ? '#15803d' : '#b91c1c'}; font-weight: 600;">
                    ${(cand.capability_match * 100).toFixed(0)}%
                  </span>
                </td>
                <td style="padding: 8px 12px; font-weight: 700; font-size: 0.9rem;">
                  ${Number(cand.total_score).toFixed(3)}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  ` : '';

  const overrideHtml = trace.override ? `
    <div style="
      background-color: #faf5ff;
      border: 1px solid #e9d5ff;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 20px;
    ">
      <div style="display: flex; align-items: center; gap: 6px; color: #7e22ce; font-weight: 700; font-size: 0.85rem;">
        <i class="fa-solid fa-user-check"></i>
        Human Override Applied (Appended to AuditLog)
      </div>
      <div style="font-size: 0.85rem; color: #581c87; margin-top: 4px;">
        <strong>New Priority:</strong> ${trace.override.overridden_priority} • <strong>By:</strong> ${trace.override.by_user_name} (ID: ${trace.override.by_user_id})
      </div>
      <div style="font-size: 0.85rem; color: #3b0764; margin-top: 4px; font-style: italic;">
        "${trace.override.reason}"
      </div>
    </div>
  ` : '';

  modalEl.innerHTML = `
    <div class="modal-content">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-heart-pulse" style="font-size: 20px; color: #4338ca;"></i>
            <h2 style="font-size: 1.25rem; font-weight: 700; color: #0f172a; margin: 0;">
              ${title}
            </h2>
          </div>
          <p style="font-size: 0.82rem; color: #64748b; margin-top: 2px;">
            Rule Engine ID: <code>${trace.rule_set_version || 'v1.2'}</code> • Trace ID: <code>${(trace.triage_id || trace.match_id || '').slice(0, 8)}</code>
          </p>
        </div>
        <button
          type="button"
          class="js-close-modal"
          style="background: none; border: none; cursor: pointer; padding: 4px; color: #64748b; font-size: 18px;"
        >
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <!-- Safety Guardrail Notice -->
      <div style="
        background-color: #eff6ff;
        border: 1px solid #bfdbfe;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 20px;
        display: flex;
        gap: 10px;
      ">
        <i class="fa-solid fa-shield-halved" style="font-size: 20px; color: #1d4ed8; flex-shrink: 0; margin-top: 2px;"></i>
        <div style="font-size: 0.85rem; color: #1e40af; line-height: 1.4;">
          <strong>Mandatory Clinical Guardrail:</strong> This output represents an <em>AI-suggested priority</em> and decision trace, not a medical diagnosis. Every signal is derived deterministically and logged to the immutable AuditLog.
        </div>
      </div>

      ${confidenceHtml}

      <!-- Clinical Summary -->
      <div style="
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 14px;
        margin-bottom: 20px;
      ">
        <div style="font-size: 0.78rem; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 6px;">
          Decision Rationale Summary
        </div>
        <div style="font-size: 0.95rem; font-weight: 600; color: #0f172a;">
          ${trace.plain_language_summary || trace.reasoning || 'Deterministic rule evaluation complete.'}
        </div>
      </div>

      ${signalsHtml}
      ${candidatesHtml}
      ${overrideHtml}

      <!-- Actions Footer -->
      <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px;">
        ${canOverride && onOpenOverride ? `
          <button
            type="button"
            class="btn-secondary js-open-override"
            style="display: inline-flex; align-items: center; gap: 6px;"
          >
            <i class="fa-solid fa-user-check"></i>
            Apply Clinical Override
          </button>
        ` : ''}
        <button type="button" class="btn-primary js-close-modal">
          Close Trace
        </button>
      </div>
    </div>
  `;

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

  modalEl.querySelectorAll('.js-close-modal').forEach((btn) => {
    btn.addEventListener('click', close);
  });

  const overrideBtn = modalEl.querySelector('.js-open-override');
  if (overrideBtn) {
    overrideBtn.addEventListener('click', () => {
      close();
      if (onOpenOverride) onOpenOverride();
    });
  }

  document.body.appendChild(modalEl);
}
