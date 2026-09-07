import React, { useState } from 'react';
import {
  Share2,
  HeartPulse,
} from 'lucide-react';
import { updateReferralStatus } from '../api/client';

export const ReferralTracker: React.FC<{
  referrals: any[];
  onRefresh: () => void;
  userRole?: string;
}> = ({ referrals, onRefresh }) => {
  const [selectedReferral, setSelectedReferral] = useState<any>(referrals[0] || null);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      setIsUpdating(true);
      await updateReferralStatus(id, newStatus);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to update referral');
    } finally {
      setIsUpdating(false);
    }
  };

  const steps = [
    { key: 'initiated', label: '1. Initiated at PHC', desc: 'Primary evaluation & stabilization' },
    { key: 'in_transit', label: '2. In Transit / Transport', desc: 'Patient en route to higher tier' },
    { key: 'received', label: '3. Received at District', desc: 'Carried-forward context verified' },
    { key: 'completed', label: '4. Case Completed', desc: 'Specialist care delivered' },
  ];

  const getStepIndex = (status: string) => {
    switch (status) {
      case 'initiated': return 0;
      case 'in_transit': return 1;
      case 'received': return 2;
      case 'completed': return 3;
      default: return 0;
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        padding: '16px 20px',
        marginBottom: '20px',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Share2 size={24} color="#7e22ce" />
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
              3-Tier Rural Healthcare Referral & Continuity Tracker
            </h2>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Sub-Centre / PHC ➔ Rural Hospital ➔ District Super-Specialty (Continuity of Clinical Record)
            </div>
          </div>
        </div>
      </div>

      {referrals.length === 0 ? (
        <div style={{ padding: '40px', backgroundColor: '#ffffff', textAlign: 'center', borderRadius: '12px' }}>
          No active referrals. Seed the demo scenario or create one in the Routine Care tab.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) 2fr', gap: '16px' }}>
          {/* Referral List */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', fontWeight: 700, fontSize: '0.85rem' }}>
              Active Referral Records ({referrals.length})
            </div>
            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {referrals.map((r) => {
                const isSelected = selectedReferral?.id === r.id;
                return (
                  <div
                    key={r.id}
                    onClick={() => setSelectedReferral(r)}
                    style={{
                      padding: '12px 14px',
                      borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? '#faf5ff' : '#ffffff',
                      borderLeft: isSelected ? '4px solid #7e22ce' : '4px solid transparent',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>
                        {r.patient_name || 'Patient'}
                      </strong>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: '#7e22ce',
                        backgroundColor: '#fae8ff',
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}>
                        {r.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.3 }}>
                      {r.reason}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px' }}>
                      {new Date(r.created_at).toLocaleDateString()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stepper Timeline & Carried-Forward Context */}
          {selectedReferral && (
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}>
              {/* Stepper Timeline */}
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  REFERRAL CHAIN PROGRESSION
                </span>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '8px',
                  marginTop: '10px',
                }}>
                  {steps.map((st, idx) => {
                    const currentIdx = getStepIndex(selectedReferral.status);
                    const isDone = idx < currentIdx;
                    const isCurrent = idx === currentIdx;

                    return (
                      <div
                        key={st.key}
                        style={{
                          border: isCurrent ? '2px solid #7e22ce' : '1px solid #e2e8f0',
                          backgroundColor: isCurrent ? '#faf5ff' : isDone ? '#f0fdf4' : '#f8fafc',
                          borderRadius: '8px',
                          padding: '10px',
                          textAlign: 'center',
                        }}
                      >
                        <div style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: isCurrent ? '#7e22ce' : isDone ? '#15803d' : '#64748b',
                          marginBottom: '4px',
                        }}>
                          {isDone ? '✔ ' : ''}{st.label}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                          {st.desc}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Carried Forward Clinical Context Payload */}
              <div style={{
                border: '1.5px solid #d8b4fe',
                borderRadius: '8px',
                backgroundColor: '#faf5ff',
                padding: '16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <HeartPulse size={18} color="#7e22ce" />
                  <strong style={{ fontSize: '0.9rem', color: '#581c87' }}>
                    Carried-Forward Clinical Context (No Patient Re-interviewing)
                  </strong>
                </div>

                <div style={{ fontSize: '0.85rem', color: '#3b0764', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>
                    <strong>Initial PHC Findings:</strong> {selectedReferral.context_payload?.initial_findings || 'Standard assessment'}
                  </div>
                  <div>
                    <strong>Triage Summary:</strong> {selectedReferral.context_payload?.triage_summary || 'P2 Urgent'}
                  </div>
                  {selectedReferral.context_payload?.vital_signs && (
                    <div style={{
                      display: 'flex',
                      gap: '12px',
                      backgroundColor: '#ffffff',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #e9d5ff',
                      fontWeight: 600,
                    }}>
                      <span>BP: {selectedReferral.context_payload.vital_signs.bp || '120/80'}</span>
                      <span>Pulse: {selectedReferral.context_payload.vital_signs.pulse || '76'} bpm</span>
                      <span>SpO2: {selectedReferral.context_payload.vital_signs.spo2 || '98'}%</span>
                    </div>
                  )}
                  <div>
                    <strong>Interventions Administered at Source:</strong>{' '}
                    {selectedReferral.context_payload?.interventions_given?.join(', ') || 'None recorded'}
                  </div>
                  <div>
                    <strong>Clinical Notes:</strong> {selectedReferral.context_payload?.notes || 'Direct referral upward'}
                  </div>
                </div>
              </div>

              {/* Status Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
                {selectedReferral.status === 'initiated' && (
                  <button
                    onClick={() => handleStatusChange(selectedReferral.id, 'in_transit')}
                    disabled={isUpdating}
                    className="btn-primary"
                    style={{ backgroundColor: '#7e22ce', fontSize: '0.85rem' }}
                  >
                    Mark as In-Transit (Dispatched)
                  </button>
                )}
                {selectedReferral.status === 'in_transit' && (
                  <button
                    onClick={() => handleStatusChange(selectedReferral.id, 'received')}
                    disabled={isUpdating}
                    className="btn-primary"
                    style={{ backgroundColor: '#15803d', fontSize: '0.85rem' }}
                  >
                    Confirm Patient Received at Hospital
                  </button>
                )}
                {selectedReferral.status === 'received' && (
                  <button
                    onClick={() => handleStatusChange(selectedReferral.id, 'completed')}
                    disabled={isUpdating}
                    className="btn-primary"
                    style={{ backgroundColor: '#0f172a', fontSize: '0.85rem' }}
                  >
                    Mark Clinical Case Completed
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
