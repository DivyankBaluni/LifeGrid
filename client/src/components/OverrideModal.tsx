import React, { useState } from 'react';
import { X, UserCheck, AlertCircle } from 'lucide-react';
import { overrideTriage } from '../api/client';

interface OverrideModalProps {
  triageId: string;
  currentPriority: 'P1' | 'P2' | 'P3' | 'P4';
  userRole?: string;
  onClose: () => void;
  onSuccess: (updatedTrace: any) => void;
}

export const OverrideModal: React.FC<OverrideModalProps> = ({
  triageId,
  currentPriority,
  userRole = 'control_center_operator',
  onClose,
  onSuccess,
}) => {
  const [selectedPriority, setSelectedPriority] = useState<'P1' | 'P2' | 'P3' | 'P4'>(currentPriority);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || reason.trim().length < 5) {
      setError('A mandatory clinical rationale (at least 5 characters) is required to override an AI triage decision.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const updated = await overrideTriage(triageId, selectedPriority, reason.trim(), userRole);
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit override');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserCheck size={20} color="#7e22ce" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
              Clinical Triage Override
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={20} />
          </button>
        </div>

        <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '16px' }}>
          As an authorized healthcare provider or control-center operator, you may override the AI-suggested triage level.
          This decision will be appended to the immutable audit trail along with your clinical rationale.
        </p>

        {error && (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fee2e2',
            color: '#b91c1c',
            padding: '10px',
            borderRadius: '6px',
            fontSize: '0.85rem',
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              New Priority Level
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {(['P1', 'P2', 'P3', 'P4'] as const).map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setSelectedPriority(p)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontWeight: 700,
                    border: selectedPriority === p ? '2px solid #1e40af' : '1px solid #cbd5e1',
                    backgroundColor: selectedPriority === p ? '#eff6ff' : '#ffffff',
                    color: selectedPriority === p ? '#1e40af' : '#475569',
                    cursor: 'pointer',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Clinical Rationale (Mandatory)
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Patient showed signs of neurovascular stability on-scene after splint application, downgrading P1 to P2."
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" onClick={onClose} className="btn-secondary" disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Recording Override...' : 'Confirm & Log Override'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
