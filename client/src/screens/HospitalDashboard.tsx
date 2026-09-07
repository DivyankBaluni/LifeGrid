import React, { useState, useEffect } from 'react';
import { Building2 } from 'lucide-react';
import { socket } from '../api/client';

export const HospitalDashboard: React.FC = () => {
  const hospitalId = 'hosp-b-district';
  const hospitalName = 'District Super-Specialty Medical Centre';
  const totalBeds = 40;
  const [incomingAlerts, setIncomingAlerts] = useState<any[]>([
    {
      id: 'LGRD-901824',
      severity: 'CRITICAL',
      condition: 'Acute Myocardial Infarction / STEMI',
      patients: 1,
      eta_minutes: 8,
      ambulance_id: 'MH-20-AX-1088 (ALS)',
      needs: ['Cath Lab', 'Cardiologist', 'Defibrillator', 'Heparin'],
      time: 'Just now',
    }
  ]);

  // Bed matrix state (bed number -> status: 'available' | 'occupied' | 'icu')
  const [bedStates, setBedStates] = useState<{ [key: number]: 'available' | 'occupied' | 'icu' }>({});

  useEffect(() => {
    // Initialize 40 demo beds
    const initial: { [key: number]: 'available' | 'occupied' | 'icu' } = {};
    for (let i = 1; i <= 40; i++) {
      if (i <= 10) initial[i] = i <= 6 ? 'icu' : 'occupied';
      else initial[i] = i % 3 === 0 ? 'occupied' : 'available';
    }
    setBedStates(initial);

    // Listen for real-time incoming alerts via socket
    const handleNewIncident = (data: any) => {
      if (data?.incident) {
        const newAlert = {
          id: `LGRD-${data.incident.id.slice(0, 6).toUpperCase()}`,
          severity: data.triage?.priority === 'P1' ? 'CRITICAL' : 'HIGH',
          condition: data.incident.raw_symptoms,
          patients: 1,
          eta_minutes: 12,
          ambulance_id: data.ambulance?.vehicle_number || 'ALS Rapid Unit',
          needs: ['Emergency Bed', 'Oxygen', 'ICU'],
          time: 'Just now',
        };
        setIncomingAlerts((prev) => [newAlert, ...prev]);
      }
    };

    socket.on('incident:new', handleNewIncident);
    return () => {
      socket.off('incident:new', handleNewIncident);
    };
  }, []);

  const toggleBed = (bedNum: number) => {
    setBedStates((prev) => {
      const current = prev[bedNum];
      const next = current === 'available' ? 'occupied' : current === 'occupied' ? 'icu' : 'available';
      return { ...prev, [bedNum]: next };
    });
  };

  const availableCount = Object.values(bedStates).filter((s) => s === 'available').length;
  const occupiedCount = Object.values(bedStates).filter((s) => s === 'occupied').length;
  const icuCount = Object.values(bedStates).filter((s) => s === 'icu').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header Card */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              backgroundColor: '#eff6ff',
              color: '#1e40af',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Building2 size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              {hospitalName}
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '4px 0 0 0' }}>
              Facility ID: <strong>{hospitalId}</strong> · Level 3 Super-Specialty District Hospital · Cath Lab & ICU Live
            </p>
          </div>
        </div>

        {/* Live Bed Count Badges */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ padding: '8px 14px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#15803d' }}>{availableCount}</div>
            <div style={{ fontSize: '0.7rem', color: '#166534', fontWeight: 600 }}>Available Beds</div>
          </div>
          <div style={{ padding: '8px 14px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#b91c1c' }}>{occupiedCount}</div>
            <div style={{ fontSize: '0.7rem', color: '#991b1b', fontWeight: 600 }}>Occupied</div>
          </div>
          <div style={{ padding: '8px 14px', backgroundColor: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#7e22ce' }}>{icuCount}</div>
            <div style={{ fontSize: '0.7rem', color: '#6b21a8', fontWeight: 600 }}>ICU Active</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Left: Interactive Bed Status Management */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                🛏️ Live Bed Allocation Grid
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0 0' }}>
                Click any bed cell to toggle state (Available 🟢 → Occupied 🔴 → ICU 🟣)
              </p>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))',
              gap: '8px',
              padding: '10px 0',
            }}
          >
            {Array.from({ length: totalBeds }, (_, i) => i + 1).map((num) => {
              const st = bedStates[num] || 'available';
              const bg = st === 'available' ? '#dcfce7' : st === 'occupied' ? '#fee2e2' : '#f3e8ff';
              const border = st === 'available' ? '#86efac' : st === 'occupied' ? '#fca5a5' : '#d8b4fe';
              const textColor = st === 'available' ? '#166534' : st === 'occupied' ? '#991b1b' : '#6b21a8';
              const icon = st === 'available' ? '🛏️' : st === 'occupied' ? '⛔' : '🏥';

              return (
                <button
                  key={num}
                  onClick={() => toggleBed(num)}
                  style={{
                    backgroundColor: bg,
                    border: `1.5px solid ${border}`,
                    borderRadius: '8px',
                    padding: '8px 4px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  title={`Bed #${num}: ${st.toUpperCase()}`}
                >
                  <span style={{ fontSize: '0.9rem' }}>{icon}</span>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: textColor }}>{num}</span>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: '16px', marginTop: '16px', fontSize: '0.75rem', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#86efac' }} /> Available
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#fca5a5' }} /> Occupied
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#d8b4fe' }} /> ICU Assigned
            </span>
          </div>
        </div>

        {/* Right: Real-time Pre-Alerts & Incoming Emergencies */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                🚨 Incoming Emergency Alerts (Real-Time)
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0 0' }}>
                Automated telemetry from dispatch units en-route to this emergency room
              </p>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e40af', backgroundColor: '#eff6ff', padding: '3px 8px', borderRadius: '6px' }}>
              {incomingAlerts.length} Active
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '420px' }}>
            {incomingAlerts.map((alert, idx) => (
              <div
                key={idx}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '14px',
                  backgroundColor: alert.severity === 'CRITICAL' ? '#fef2f2' : '#fffbeb',
                  borderLeft: `4px solid ${alert.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b'}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      backgroundColor: alert.severity === 'CRITICAL' ? '#b91c1c' : '#b45309',
                      color: '#ffffff',
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    {alert.severity}
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a' }}>
                    ⏱️ ETA: {alert.eta_minutes} min
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                  {alert.condition}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '8px' }}>
                  Unit: <strong>{alert.ambulance_id}</strong> · Patients: {alert.patients} · {alert.time}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {alert.needs.map((nd: string, nIdx: number) => (
                    <span
                      key={nIdx}
                      style={{
                        fontSize: '0.68rem',
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        padding: '2px 6px',
                        fontWeight: 600,
                        color: '#334155',
                      }}
                    >
                      ✓ {nd}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
