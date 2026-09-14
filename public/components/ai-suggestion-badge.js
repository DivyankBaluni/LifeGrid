// AI Suggestion Badge Component (Vanilla ES6)

export function renderAISuggestionBadge(label = 'AI-suggested priority', hasReasoning = false, reasoningAction = '') {
  return `
    <div style="display: inline-flex; align-items: center; gap: 8px;">
      <span class="badge-ai" title="Computed by deterministic clinical rule-engine">
        <i class="fa-solid fa-wand-magic-sparkles" style="font-size: 11px;"></i>
        ${label}
      </span>
      ${hasReasoning ? `
        <button
          type="button"
          class="btn-secondary js-view-reasoning"
          ${reasoningAction ? `data-action="${reasoningAction}"` : ''}
          style="
            font-size: 0.75rem;
            padding: 2px 8px;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            color: #4338ca;
            border-color: #c7d2fe;
            background-color: #eef2ff;
          "
        >
          <i class="fa-solid fa-circle-question" style="font-size: 11px;"></i>
          View reasoning
        </button>
      ` : ''}
    </div>
  `;
}
