import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckSquare,
  Square,
  Building,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';
import { TriageBadge } from '../components/Badges';
import { AISuggestionBadge } from '../components/AISuggestionBadge';
import { ExplainabilityModal } from '../components/ExplainabilityModal';
import { getHospitalAlerts, acknowledgeAlert } from '../api/client';

export const HospitalPreAlert: React.FC<{ hospitalId?: string }> = ({
  hospitalId = 'hosp-b-district',
}) => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  const [checklist, setChecklist] = useState({
    bed_confirmed: false,
    specialist_confirmed: false,
    equipment_confirmed: false,
  });
  const [isAcking, setIsAcking] = useState(false);
  const [showTrace, setShowTrace] = useState(false);
  const [traceData, setTraceData] = useState<any>(null);

  const loadAlerts = async () => {
    try {
      const data = await getHospitalAlerts(hospitalId);
      setAlerts(data);
      if (data.length > 0 && !selectedAlert) {
        setSelectedAlert(data[0]);
        setChecklist({
          bed_confirmed: data[0].readiness_checklist?.bed_confirmed || false,
          specialist_confirmed: data[0].readiness_checklist?.specialist_confirmed || false,
          equipment_confirmed: data[0].readiness_checklist?.equipment_confirmed || false,
        });
      }
    } catch (err) {
      console.error('Failed to load hospital alerts', err);
    }
  };

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 5000);
    return () => clearInterval(interval);
  }, [hospitalId]);

  const handleAcknowledge = async () => {
    if (!selectedAlert) return;
    try {
      setIsAcking(true);
      const updated = await acknowledgeAlert(selectedAlert.id, checklist);
      setSelectedAlert(updated);
      await loadAlerts();
    } catch (err: any) {
      alert(err.message || 'Failed to acknowledge alert');
    } finally {
      setIsAcking(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Hospital Banner */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Building size={24} color="#1e40af" />
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
              District Super-Specialty Medical Centre (Hospital B)
            </h2>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Trauma & Emergency Department Receiving Console • 12/40 Beds Available
            </div>
          </div>
        </div>

        <button
          onClick={loadAlerts}
          className="btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '6px 12px' }}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {alerts.length === 0 ? (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '40px',
          textAlign: 'center',
          color: '#64748b',
        }}>
          <CheckCircle size={36} color="#15803d" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>No Incoming Pre-Alerts</h3>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>
            All incoming emergency cases have been received and admitted. Standing by for regional dispatches.
          </p>
        </div>
      ) : (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '2px solid #b91c1c',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-md)',
        }}>
          {/* Urgent Incoming Header */}
          <div style={{
            backgroundColor: '#fee2e2',
            borderBottom: '1px solid #fecdd3',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Bell size={22} color="#b91c1c" />
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase' }}>
                  URGENT INCOMING PRE-ALERT
                </span>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#7f1d1d' }}>
                  Trauma / Cardiac Resuscitation Required
                </div>
              </div>
            </div>

            {/* Big ETA Countdown Display */}
            <div style={{
              backgroundColor: '#b91c1c',
              color: '#ffffff',
              borderRadius: '8px',
              padding: '8px 16px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                ESTIMATED ETA
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'monospace', lineHeight: 1.1 }}>
                ~{selectedAlert?.eta_minutes || 14} MIN
              </div>
            </div>
          </div>

          {/* Patient Details & AI Suggestion */}
          <div style={{ padding: '20px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '14px',
              marginBottom: '20px',
            }}>
              <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>TRIAGE PRIORITY</span>
                <div style={{ marginTop: '4px' }}>
                  <TriageBadge priority="P1" />
                </div>
                <div style={{ marginTop: '8px' }}>
                  <AISuggestionBadge
                    label="AI-suggested priority"
                    onViewReasoning={async () => {
                      try {
                        const res = await fetch(`http://localhost:3001/api/incidents/${selectedAlert.incident_id}`);
                        const incData = await res.json();
                        setTraceData(incData.triage_trace);
                        setShowTrace(true);
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                  />
                </div>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>PATIENT PROFILE</span>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                  Bhagwanrao Deshmukh (68 yrs)
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                  Known history of Hypertension & Angina
                </div>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>REPORTED SYMPTOMS</span>
                <div style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 600, marginTop: '4px' }}>
                  Crushing chest pain, radiating arm pain, profuse sweating
                </div>
              </div>
            </div>

            {/* Readiness Checklist - Mandatory Section for Hospital Staff */}
            <div style={{
              border: '1.5px solid #cbd5e1',
              borderRadius: '10px',
              padding: '16px',
              backgroundColor: '#f8fafc',
              marginBottom: '20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                  Facility Readiness Checklist
                </h4>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {selectedAlert?.status === 'acknowledged' ? 'Status: Confirmed Ready' : 'Pending Confirmation'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div
                  onClick={() => setChecklist({ ...checklist, bed_confirmed: !checklist.bed_confirmed })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    cursor: 'pointer',
                  }}
                >
                  {checklist.bed_confirmed ? (
                    <CheckSquare size={20} color="#15803d" />
                  ) : (
                    <Square size={20} color="#94a3b8" />
                  )}
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1e293b' }}>
                    1. Cardiac Resuscitation ICU Bed Reserved (Bay 3 confirmed)
                  </div>
                </div>

                <div
                  onClick={() => setChecklist({ ...checklist, specialist_confirmed: !checklist.specialist_confirmed })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    cursor: 'pointer',
                  }}
                >
                  {checklist.specialist_confirmed ? (
                    <CheckSquare size={20} color="#15803d" />
                  ) : (
                    <Square size={20} color="#94a3b8" />
                  )}
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1e293b' }}>
                    2. On-call Cardiologist (Dr. Anita Joshi) Notified & scrubbed
                  </div>
                </div>

                <div
                  onClick={() => setChecklist({ ...checklist, equipment_confirmed: !checklist.equipment_confirmed })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    cursor: 'pointer',
                  }}
                >
                  {checklist.equipment_confirmed ? (
                    <CheckSquare size={20} color="#15803d" />
                  ) : (
                    <Square size={20} color="#94a3b8" />
                  )}
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1e293b' }}>
                    3. Cath Lab & Defibrillator Powered & Ready for Transfer
                  </div>
                </div>
              </div>
            </div>

            {/* Acknowledgment Action Button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Acknowledging pre-alert transmits immediate readiness signal to ambulance EMT & Control Center.
              </div>
              <button
                onClick={handleAcknowledge}
                disabled={isAcking || selectedAlert?.status === 'acknowledged'}
                className="btn-primary"
                style={{
                  padding: '12px 24px',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  backgroundColor: selectedAlert?.status === 'acknowledged' ? '#15803d' : '#1e40af',
                }}
              >
                {selectedAlert?.status === 'acknowledged'
                  ? '✔ PRE-ALERT ACKNOWLEDGED'
                  : isAcking
                  ? 'Transmitting...'
                  : 'Acknowledge Ready'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTrace && traceData && (
        <ExplainabilityModal
          trace={traceData}
          onClose={() => setShowTrace(false)}
        />
      )}
    </div>
  );
};
