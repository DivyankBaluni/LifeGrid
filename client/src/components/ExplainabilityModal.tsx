import React from 'react';
import { X, ShieldAlert, CheckCircle2, AlertTriangle, UserCheck, Activity } from 'lucide-react';

interface ExplainabilityModalProps {
  trace: any;
  onClose: () => void;
  onOpenOverride?: () => void;
  canOverride?: boolean;
}

export const ExplainabilityModal: React.FC<ExplainabilityModalProps> = ({
  trace,
  onClose,
  onOpenOverride,
  canOverride = false,
}) => {
  if (!trace) return null;

  const isHospitalMatch = trace.target_type === 'hospital';
  const isAmbulanceMatch = trace.target_type === 'ambulance';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={20} color="#4338ca" />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                {isHospitalMatch
                  ? 'Hospital Match Decision Trace'
                  : isAmbulanceMatch
                  ? 'Ambulance Dispatch Decision Trace'
                  : 'AI Triage Explainability Trace'}
              </h2>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>
              Rule Engine ID: <code>{trace.rule_set_version || 'v1.2'}</code> • Trace ID: <code>{(trace.triage_id || trace.match_id || '').slice(0, 8)}</code>
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#64748b' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Safety Guardrail Notice */}
        <div style={{
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '20px',
          display: 'flex',
          gap: '10px',
        }}>
          <ShieldAlert size={20} color="#1d4ed8" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '0.85rem', color: '#1e40af', lineHeight: 1.4 }}>
            <strong>Mandatory Clinical Guardrail:</strong> This output represents an <em>AI-suggested priority</em> and decision trace, not a medical diagnosis. Every signal is derived deterministically and logged to the immutable AuditLog.
          </div>
        </div>

        {/* Confidence Flags */}
        {trace.confidence_flags && (
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            {trace.confidence_flags.incomplete_input && (
              <span style={{
                backgroundColor: '#fff7ed',
                color: '#c2410c',
                border: '1px solid #ffedd5',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <AlertTriangle size={14} />
                Incomplete Input Flagged
              </span>
            )}
            {trace.confidence_flags.conflicting_input && (
              <span style={{
                backgroundColor: '#fef2f2',
                color: '#b91c1c',
                border: '1px solid #fee2e2',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <AlertTriangle size={14} />
                Conflicting Signals — Defaulted to High Urgency (Safe Failure)
              </span>
            )}
            {!trace.confidence_flags.incomplete_input && !trace.confidence_flags.conflicting_input && (
              <span style={{
                backgroundColor: '#f0fdf4',
                color: '#15803d',
                border: '1px solid #dcfce7',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <CheckCircle2 size={14} />
                Confidence Check Passed (Consistent Input)
              </span>
            )}
          </div>
        )}

        {/* Clinical Summary */}
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '14px',
          marginBottom: '20px',
        }}>
          <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>
            Decision Rationale Summary
          </div>
          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>
            {trace.plain_language_summary || trace.reasoning}
          </div>
        </div>

        {/* Signals Fired for Triage */}
        {trace.signals_fired && (
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', marginBottom: '10px' }}>
              Fired Clinical Signals ({trace.signals_fired.length})
            </h4>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead style={{ backgroundColor: '#f1f5f9', textAlign: 'left' }}>
                  <tr>
                    <th style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>Rule ID</th>
                    <th style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>Clinical Reason</th>
                    <th style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0', width: '80px' }}>Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {trace.signals_fired.map((sig: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600, color: '#334155' }}>
                        {sig.rule}
                      </td>
                      <td style={{ padding: '8px 12px', color: '#1e293b' }}>{sig.reason}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>{sig.weight}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Candidate Evaluations for Hospital / Ambulance Matching */}
        {trace.candidate_evaluations && (
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', marginBottom: '10px' }}>
              Candidate Facility Scoring ("Best fit, not nearest")
            </h4>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead style={{ backgroundColor: '#f1f5f9', textAlign: 'left' }}>
                  <tr>
                    <th style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>Facility</th>
                    <th style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>Distance / ETA</th>
                    <th style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>Capability Match</th>
                    <th style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>Total Score</th>
                  </tr>
                </thead>
                <tbody>
                  {trace.candidate_evaluations.map((cand: any) => (
                    <tr
                      key={cand.id}
                      style={{
                        backgroundColor: cand.id === trace.selected_id ? '#f0fdf4' : 'transparent',
                        borderBottom: '1px solid #f1f5f9',
                      }}
                    >
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                        {cand.name}
                        {cand.id === trace.selected_id && (
                          <span style={{ marginLeft: '6px', fontSize: '0.75rem', color: '#15803d', fontWeight: 700 }}>
                            (SELECTED)
                          </span>
                        )}
                        {cand.capped_due_to_missing_required_tag && (
                          <div style={{ fontSize: '0.75rem', color: '#b91c1c', fontWeight: 500 }}>
                            Capped: Lacks required capability [{cand.missing_tags.join(', ')}]
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {cand.distance_km} km ({cand.eta_minutes} min)
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{
                          color: cand.capability_match >= 0.8 ? '#15803d' : '#b91c1c',
                          fontWeight: 600,
                        }}>
                          {(cand.capability_match * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 700, fontSize: '0.9rem' }}>
                        {cand.total_score.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Human Override Status */}
        {trace.override && (
          <div style={{
            backgroundColor: '#faf5ff',
            border: '1px solid #e9d5ff',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#7e22ce', fontWeight: 700, fontSize: '0.85rem' }}>
              <UserCheck size={16} />
              Human Override Applied (Appended to AuditLog)
            </div>
            <div style={{ fontSize: '0.85rem', color: '#581c87', marginTop: '4px' }}>
              <strong>New Priority:</strong> {trace.override.overridden_priority} • <strong>By:</strong> {trace.override.by_user_name} (ID: {trace.override.by_user_id})
            </div>
            <div style={{ fontSize: '0.85rem', color: '#3b0764', marginTop: '4px', fontStyle: 'italic' }}>
              "{trace.override.reason}"
            </div>
          </div>
        )}

        {/* Actions Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
          {canOverride && onOpenOverride && (
            <button
              onClick={() => {
                onClose();
                onOpenOverride();
              }}
              className="btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <UserCheck size={16} />
              Apply Clinical Override
            </button>
          )}
          <button onClick={onClose} className="btn-primary">
            Close Trace
          </button>
        </div>
      </div>
    </div>
  );
};
