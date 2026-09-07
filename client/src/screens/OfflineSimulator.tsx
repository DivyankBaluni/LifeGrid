import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Phone,
  Send,
  Radio,
  Terminal,
  RefreshCw,
} from 'lucide-react';
import { sendSimulatedSMS, sendSimulatedIVR, fetchOutboundSMSLogs } from '../api/client';

export const OfflineSimulator: React.FC<{ onRefresh: () => void }> = ({ onRefresh }) => {
  const [phoneNumber, setPhoneNumber] = useState('+919876543210');
  const [smsBody, setSmsBody] = useState('EMRG severe chest pain LOC:Village_Rampur');
  const [isSending, setIsSending] = useState(false);
  const [outboundLogs, setOutboundLogs] = useState<any[]>([]);

  const loadLogs = async () => {
    try {
      const logs = await fetchOutboundSMSLogs();
      setOutboundLogs(logs);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleSendSMS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smsBody.trim()) return;

    try {
      setIsSending(true);
      await sendSimulatedSMS(phoneNumber, smsBody);
      await loadLogs();
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to simulate SMS');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendIVR = async (digits: string) => {
    try {
      setIsSending(true);
      await sendSimulatedIVR(phoneNumber, digits);
      await loadLogs();
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to simulate IVR');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        padding: '16px 20px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Radio size={24} color="#0369a1" />
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
              Offline / SMS / IVR Telephony Gateway Test Bench
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Simulates carrier SMS keyword parsing and keypad IVR menu for zero-internet rural reporting.
            </p>
          </div>
        </div>

        <button
          onClick={loadLogs}
          className="btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
        >
          <RefreshCw size={14} />
          Refresh Logs
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        {/* Left: Interactive Simulators */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* SMS Simulator Card */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <MessageSquare size={18} color="#0369a1" />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                Simulate Inbound Carrier SMS
              </h3>
            </div>

            <form onSubmit={handleSendSMS}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Sender Mobile Number
                </label>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  SMS Text Content (Keywords supported: EMRG, LOC)
                </label>
                <textarea
                  rows={3}
                  value={smsBody}
                  onChange={(e) => setSmsBody(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    fontFamily: 'monospace',
                  }}
                />
              </div>

              {/* Sample SMS Presets */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={() => setSmsBody('EMRG severe chest pain LOC:Village_Rampur')}
                  className="btn-secondary"
                  style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                >
                  Cardiac Preset
                </button>
                <button
                  type="button"
                  onClick={() => setSmsBody('EMRG compound leg fracture LOC:Highway_Milestone_12')}
                  className="btn-secondary"
                  style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                >
                  Trauma Preset
                </button>
                <button
                  type="button"
                  onClick={() => setSmsBody('EMRG snake bite venom LOC:Rampur_Farm')}
                  className="btn-secondary"
                  style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                >
                  Snakebite Preset
                </button>
              </div>

              <button
                type="submit"
                disabled={isSending}
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                }}
              >
                <Send size={16} />
                {isSending ? 'Transmitting Inbound SMS...' : 'Transmit Inbound SMS'}
              </button>
            </form>
          </div>

          {/* IVR Audio Keypad Simulator */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Phone size={18} color="#15803d" />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                Simulate Missed-Call Callback & IVR Keypad Menu
              </h3>
            </div>
            <p style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '14px' }}>
              Automated IVR speaks menu in regional language; caller taps 1-3 on keypad:
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                onClick={() => handleSendIVR('1')}
                disabled={isSending}
                style={{
                  padding: '12px 8px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#f8fafc',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#b91c1c' }}>1</div>
                <div style={{ fontSize: '0.72rem', color: '#0f172a', fontWeight: 600 }}>Cardiac / Chest</div>
              </button>

              <button
                type="button"
                onClick={() => handleSendIVR('2')}
                disabled={isSending}
                style={{
                  padding: '12px 8px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#f8fafc',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ea580c' }}>2</div>
                <div style={{ fontSize: '0.72rem', color: '#0f172a', fontWeight: 600 }}>Trauma / Bleeding</div>
              </button>

              <button
                type="button"
                onClick={() => handleSendIVR('3')}
                disabled={isSending}
                style={{
                  padding: '12px 8px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#f8fafc',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0284c7' }}>3</div>
                <div style={{ fontSize: '0.72rem', color: '#0f172a', fontWeight: 600 }}>Breathing Gasping</div>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Outbound SMS Carrier Transmit Log */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <Terminal size={16} color="#38bdf8" />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: 'monospace' }}>
              CARRIER OUTBOUND SMS FEED
            </span>
          </div>

          <div style={{ flex: 1, padding: '14px', overflowY: 'auto', maxHeight: '500px', backgroundColor: '#f8fafc' }}>
            {outboundLogs.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center', padding: '30px' }}>
                No outbound SMS messages dispatched yet.
              </div>
            ) : (
              outboundLogs.map((log, i) => (
                <div
                  key={i}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '10px',
                    marginBottom: '10px',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.75rem' }}>
                    <strong style={{ color: '#0369a1' }}>To: {log.to}</strong>
                    <span style={{ color: '#94a3b8' }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: '#1e293b', fontFamily: 'monospace', lineHeight: 1.3 }}>
                    {log.body}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
