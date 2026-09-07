import React from 'react';
import { Sparkles, HelpCircle } from 'lucide-react';

interface AISuggestionBadgeProps {
  label?: string;
  onViewReasoning?: () => void;
}

export const AISuggestionBadge: React.FC<AISuggestionBadgeProps> = ({
  label = 'AI-suggested priority',
  onViewReasoning,
}) => {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
      <span className="badge-ai" title="Computed by deterministic clinical rule-engine">
        <Sparkles size={13} />
        {label}
      </span>
      {onViewReasoning && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewReasoning();
          }}
          className="btn-secondary"
          style={{
            fontSize: '0.75rem',
            padding: '2px 8px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            color: '#4338ca',
            borderColor: '#c7d2fe',
            backgroundColor: '#eef2ff',
          }}
        >
          <HelpCircle size={12} />
          View reasoning
        </button>
      )}
    </div>
  );
};
