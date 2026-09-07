import React, { useState, useEffect } from 'react';
import {
  Activity,
  Building2,
  Globe,
  Radio,
  RefreshCw,
  Share2,
  Stethoscope,
  Terminal,
  Shield,
  Ambulance,
  LayoutGrid,
} from 'lucide-react';
import { fetchDashboardOverview, resetDemoScenario, socket } from './api/client';
import { ControlCenter } from './screens/ControlCenter';
import { CitizenEmergency } from './screens/CitizenEmergency';
import { RoutineTriage } from './screens/RoutineTriage';
import { HospitalPreAlert } from './screens/HospitalPreAlert';
import { ReferralTracker } from './screens/ReferralTracker';
import { OfflineSimulator } from './screens/OfflineSimulator';
import { HospitalDashboard } from './screens/HospitalDashboard';
import { AmbulanceFleetScreen } from './screens/AmbulanceFleetScreen';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('control-center');
  const [userRole, setUserRole] = useState<string>('control_center_operator');
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const [overviewData, setOverviewData] = useState<any>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);

  const loadData = async () => {
    try {
      const data = await fetchDashboardOverview();
      setOverviewData(data);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    }
  };

  useEffect(() => {
    loadData();

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    // Real-time WebSocket event triggers
    socket.on('incident:new', () => loadData());
    socket.on('triage:override', () => loadData());
    socket.on('alert:acknowledged', () => loadData());
    socket.on('referral:new', () => loadData());
    socket.on('referral:update', () => loadData());
    socket.on('dashboard:refresh', () => loadData());

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('incident:new');
      socket.off('triage:override');
      socket.off('alert:acknowledged');
      socket.off('referral:new');
      socket.off('referral:update');
      socket.off('dashboard:refresh');
    };
  }, []);

  const handleResetDemo = async () => {
    try {
      setIsResetting(true);
      await resetDemoScenario();
      await loadData();
      alert('Demo scenarios seeded successfully: Hospital A/B Cardiac Emergency, 3-Tier Referral Chain, and SMS Low-Connectivity Incident initialized.');
    } catch (err: any) {
      alert(err.message || 'Failed to reset demo');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Institutional Header */}
      <header style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        boxShadow: 'var(--shadow-sm)',
      }}>
        {/* Brand & Tagline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            backgroundColor: '#1e40af',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontWeight: 900,
            fontSize: '1.2rem',
            letterSpacing: '-0.05em',
          }}>
            LG
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                LIFEGRID
              </h1>
              <span style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                color: '#1e40af',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                padding: '2px 6px',
                borderRadius: '4px',
              }}>
                SIH26133
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: isConnected ? '#15803d' : '#ea580c',
                  display: 'inline-block',
                }} />
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  {isConnected ? 'Live WebSocket' : 'Connecting...'}
                </span>
              </div>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Rural Healthcare Accessibility & Emergency Coordination Monolith
            </p>
          </div>
        </div>

        {/* Controls: Role Switcher, Language Toggle, Demo Reset */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Demo Role Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '6px' }}>
            <Shield size={14} color="#64748b" />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>Role:</span>
            <select
              value={userRole}
              onChange={(e) => setUserRole(e.target.value)}
              style={{
                border: 'none',
                backgroundColor: 'transparent',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: '#0f172a',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="control_center_operator">Control Center Operator</option>
              <option value="health_worker">ASHA / Frontline Health Worker</option>
              <option value="hospital_staff">Hospital Emergency Staff</option>
              <option value="citizen">Rural Citizen / Bystander</option>
            </select>
          </div>

          {/* Language Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Globe size={14} color="#64748b" />
            <button
              onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
              className="btn-secondary"
              style={{ fontSize: '0.75rem', padding: '4px 8px' }}
            >
              {language === 'en' ? 'हिंदी' : 'English'}
            </button>
          </div>

          {/* Reset / Seed Demo Scenario Button */}
          <button
            onClick={handleResetDemo}
            disabled={isResetting}
            className="btn-primary"
            style={{
              fontSize: '0.78rem',
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#0f172a',
            }}
          >
            <RefreshCw size={12} />
            {isResetting ? 'Seeding...' : 'Reset Demo (Hospital A/B)'}
          </button>
        </div>
      </header>

      {/* Navigation Sub-header Tabs */}
      <nav style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '0 24px',
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
      }}>
        {[
          { id: 'control-center', label: 'Control Center Live', icon: <Radio size={16} /> },
          { id: 'citizen-emergency', label: 'Citizen Emergency', icon: <Activity size={16} /> },
          { id: 'hospital-dashboard', label: 'Hospital Bed Matrix', icon: <LayoutGrid size={16} /> },
          { id: 'ambulance-fleet', label: 'Fleet Telemetry & 3D', icon: <Ambulance size={16} /> },
          { id: 'routine-triage', label: 'Primary Care Guidance', icon: <Stethoscope size={16} /> },
          { id: 'hospital-pre-alert', label: 'Hospital Pre-Alert', icon: <Building2 size={16} /> },
          { id: 'referral-tracker', label: '3-Tier Referral Tracker', icon: <Share2 size={16} /> },
          { id: 'offline-simulator', label: 'Offline / SMS Testbench', icon: <Terminal size={16} /> },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 14px',
                border: 'none',
                background: 'none',
                borderBottom: isActive ? '3px solid #1e40af' : '3px solid transparent',
                color: isActive ? '#1e40af' : '#64748b',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.85rem',
                borderRadius: 0,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Main Screen Content */}
      <main style={{ flex: 1, padding: '20px 24px' }}>
        {activeTab === 'control-center' && (
          <ControlCenter
            overviewData={overviewData}
            onRefresh={loadData}
            userRole={userRole}
          />
        )}

        {activeTab === 'citizen-emergency' && (
          <CitizenEmergency language={language} />
        )}

        {activeTab === 'hospital-dashboard' && (
          <HospitalDashboard />
        )}

        {activeTab === 'ambulance-fleet' && (
          <AmbulanceFleetScreen />
        )}

        {activeTab === 'routine-triage' && (
          <RoutineTriage userRole={userRole} />
        )}

        {activeTab === 'hospital-pre-alert' && (
          <HospitalPreAlert hospitalId="hosp-b-district" />
        )}

        {activeTab === 'referral-tracker' && (
          <ReferralTracker
            referrals={overviewData?.referrals || []}
            onRefresh={loadData}
            userRole={userRole}
          />
        )}

        {activeTab === 'offline-simulator' && (
          <OfflineSimulator onRefresh={loadData} />
        )}
      </main>

      {/* Footer Notice */}
      <footer style={{
        padding: '12px 24px',
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        fontSize: '0.75rem',
        color: '#64748b',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        <div>
          <strong>LIFEGRID SIH26133:</strong> Rural & Underserved Healthcare Accessibility. Deterministic AI Triage with mandatory explainability traces and clinical override path.
        </div>
        <div>
          Status: <strong>Operational Monolith</strong>
        </div>
      </footer>
    </div>
  );
};

export default App;
