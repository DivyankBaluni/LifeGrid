import React, { useState, useEffect } from 'react';
import { Ambulance, Box } from 'lucide-react';
import { fetchPanIndiaAmbulances } from '../api/client';
import { Ambulance3DViewer } from '../components/Ambulance3DViewer';

export const AmbulanceFleetScreen: React.FC = () => {
  const [ambulances, setAmbulances] = useState<any[]>([]);
  const [selectedAmbulance3D, setSelectedAmbulance3D] = useState<any | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchDistrict, setSearchDistrict] = useState<string>('');

  useEffect(() => {
    const loadFleet = async () => {
      try {
        const data = await fetchPanIndiaAmbulances();
        setAmbulances(data);
      } catch (err) {
        console.error('Failed to load ambulance fleet:', err);
      }
    };
    loadFleet();
  }, []);

  const filtered = ambulances.filter((a) => {
    const matchesType = filterType === 'all' || a.type === filterType;
    const matchesDist = !searchDistrict || (a.district || '').toLowerCase().includes(searchDistrict.toLowerCase());
    return matchesType && matchesDist;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Controls Header */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ambulance size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              National Emergency Fleet Telemetry & 3D Diagnostics
            </h2>
            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '3px 0 0 0' }}>
              Monitoring 32 Advanced Life Support, Mobile ICU, and Basic Life Support units across India
            </p>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Filter by district (e.g. Pune, Dehradun)..."
            value={searchDistrict}
            onChange={(e) => setSearchDistrict(e.target.value)}
            style={{
              fontSize: '0.8rem',
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              outline: 'none',
            }}
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{
              fontSize: '0.8rem',
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              fontWeight: 600,
              color: '#334155',
            }}
          >
            <option value="all">All Vehicle Classes</option>
            <option value="ALS">ALS — Advanced Life Support</option>
            <option value="MICU">MICU — Mobile ICU</option>
            <option value="BLS">BLS — Basic Life Support</option>
            <option value="NEO">NEO — Neonatal Transport</option>
          </select>
        </div>
      </div>

      {/* Ambulance Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '16px',
        }}
      >
        {filtered.map((amb) => {
          const isAvailable = amb.status === 'available';
          const typeBadgeColor =
            amb.type === 'MICU'
              ? '#7e22ce'
              : amb.type === 'ALS'
              ? '#dc2626'
              : amb.type === 'NEO'
              ? '#ea580c'
              : '#2563eb';

          return (
            <div
              key={amb.id}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                padding: '16px',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                        {amb.name}
                      </span>
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          backgroundColor: `${typeBadgeColor}15`,
                          color: typeBadgeColor,
                          border: `1px solid ${typeBadgeColor}40`,
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        {amb.type}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                      {amb.type_label} · Plate: <strong>{amb.license_plate}</strong>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      backgroundColor: isAvailable ? '#dcfce7' : '#fee2e2',
                      color: isAvailable ? '#15803d' : '#b91c1c',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      border: `1px solid ${isAvailable ? '#86efac' : '#fca5a5'}`,
                    }}
                  >
                    {isAvailable ? 'AVAILABLE' : 'DISPATCHED'}
                  </span>
                </div>

                <div style={{ fontSize: '0.78rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '4px', margin: '10px 0' }}>
                  <div>
                    📍 Base District: <strong>{amb.district}</strong> {amb.state ? `(${amb.state})` : ''}
                  </div>
                  <div>
                    👨‍✈️ Driver: <strong>{amb.driver}</strong> ({amb.driver_phone})
                  </div>
                  <div>
                    🩺 Paramedic / Crew: <strong>{amb.paramedic}</strong> · Cap: <strong>{amb.capacity} patients</strong>
                  </div>
                </div>

                <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '12px' }}>
                  <strong>Key Equipment:</strong>{' '}
                  {(amb.equipment || []).slice(0, 4).join(', ')}...
                </div>
              </div>

              {/* Action: Open 3D Inspector */}
              <button
                onClick={() => setSelectedAmbulance3D(amb)}
                style={{
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'background 0.2s',
                }}
              >
                <Box size={14} color="#38bdf8" />
                Inspect 3D Ambulance Model
              </button>
            </div>
          );
        })}
      </div>

      {/* 3D Visualizer Modal */}
      {selectedAmbulance3D && (
        <Ambulance3DViewer
          ambulance={selectedAmbulance3D}
          onClose={() => setSelectedAmbulance3D(null)}
        />
      )}
    </div>
  );
};
