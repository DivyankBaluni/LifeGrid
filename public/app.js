// LIFEGRID Vanilla ES6 Application Orchestrator
import { fetchDashboardOverview, resetDemoScenario, socket } from './api.js';
import { createControlCenterScreen } from './screens/control-center.js';
import { createCitizenEmergencyScreen } from './screens/citizen-emergency.js';
import { createHospitalDashboardScreen } from './screens/hospital-dashboard.js';
import { createAmbulanceFleetScreen } from './screens/ambulance-fleet.js';
import { createRoutineTriageScreen } from './screens/routine-triage.js';
import { createHospitalPreAlertScreen } from './screens/hospital-pre-alert.js';
import { createReferralTrackerScreen } from './screens/referral-tracker.js';
import { createOfflineSimulatorScreen } from './screens/offline-simulator.js';

class LifeGridApp {
  constructor(rootEl) {
    this.root = rootEl;
    this.activeTab = 'control-center';
    this.userRole = 'control_center_operator';
    this.language = 'en';
    this.overviewData = null;
    this.isConnected = false;
    this.isResetting = false;
    this.activeScreenInstance = null;

    this.tabs = [
      { id: 'control-center', label: 'Control Center Live', icon: 'fa-solid fa-satellite-dish' },
      { id: 'citizen-emergency', label: 'Citizen Emergency', icon: 'fa-solid fa-heart-pulse' },
      { id: 'hospital-dashboard', label: 'Hospital Bed Matrix', icon: 'fa-solid fa-table-cells-large' },
      { id: 'ambulance-fleet', label: 'Fleet Telemetry & 3D', icon: 'fa-solid fa-truck-medical' },
      { id: 'routine-triage', label: 'Primary Care Guidance', icon: 'fa-solid fa-stethoscope' },
      { id: 'hospital-pre-alert', label: 'Hospital Pre-Alert', icon: 'fa-solid fa-building' },
      { id: 'referral-tracker', label: '3-Tier Referral Tracker', icon: 'fa-solid fa-share-nodes' },
      { id: 'offline-simulator', label: 'Offline / SMS Testbench', icon: 'fa-solid fa-terminal' },
    ];

    this.init();
  }

  async init() {
    this.renderShell();
    this.bindShellEvents();
    this.switchTab(this.activeTab);
    this.initWebSocket();
    this.loadData();
  }

  async loadData() {
    try {
      this.overviewData = await fetchDashboardOverview();
      this.updateActiveScreenData();
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    }
  }

  initWebSocket() {
    if (!socket) return;

    socket.on('connect', () => {
      this.isConnected = true;
      this.updateConnectionStatus();
    });

    socket.on('disconnect', () => {
      this.isConnected = false;
      this.updateConnectionStatus();
    });

    // Real-time events
    const reload = () => this.loadData();
    socket.on('incident:new', reload);
    socket.on('triage:override', reload);
    socket.on('alert:acknowledged', reload);
    socket.on('referral:new', reload);
    socket.on('referral:update', reload);
    socket.on('dashboard:refresh', reload);
  }

  updateConnectionStatus() {
    const dot = this.root.querySelector('#ws-status-dot');
    const text = this.root.querySelector('#ws-status-text');
    if (dot) dot.style.backgroundColor = this.isConnected ? '#15803d' : '#ea580c';
    if (text) text.textContent = this.isConnected ? 'Live WebSocket' : 'Connecting...';
  }

  updateActiveScreenData() {
    if (this.activeScreenInstance && typeof this.activeScreenInstance.update === 'function') {
      if (this.activeTab === 'referral-tracker') {
        this.activeScreenInstance.update(this.overviewData?.referrals || []);
      } else if (this.activeTab === 'control-center') {
        this.activeScreenInstance.update(this.overviewData);
      }
    }
  }

  renderShell() {
    this.root.innerHTML = `
      <div style="min-height: 100vh; display: flex; flex-direction: column;">
        <!-- Top Institutional Header -->
        <header style="
          background-color: #ffffff;
          border-bottom: 1px solid #e2e8f0;
          padding: 12px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          box-shadow: var(--shadow-sm);
        ">
          <!-- Brand & Tagline -->
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="
              width: 38px;
              height: 38px;
              background-color: #1e40af;
              border-radius: 8px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #ffffff;
              font-weight: 900;
              font-size: 1.2rem;
              letter-spacing: -0.05em;
            ">
              LG
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <h1 style="font-size: 1.2rem; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; margin: 0;">
                  LIFEGRID
                </h1>
                <span style="
                  font-size: 0.68rem;
                  font-weight: 700;
                  color: #1e40af;
                  background-color: #eff6ff;
                  border: 1px solid #bfdbfe;
                  padding: 2px 6px;
                  border-radius: 4px;
                ">
                  SIH26133
                </span>
                <div style="display: flex; align-items: center; gap: 4px; margin-left: 6px;">
                  <span id="ws-status-dot" style="
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background-color: #ea580c;
                    display: inline-block;
                  "></span>
                  <span id="ws-status-text" style="font-size: 0.72rem; color: #64748b;">
                    Connecting...
                  </span>
                </div>
              </div>
              <p style="font-size: 0.75rem; color: #64748b; margin: 2px 0 0 0;">
                Rural Healthcare Accessibility & Emergency Coordination Monolith
              </p>
            </div>
          </div>

          <!-- Controls: Role Switcher, Language Toggle, Demo Reset -->
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <!-- Demo Role Switcher -->
            <div style="display: flex; align-items: center; gap: 6px; background-color: #f1f5f9; padding: 4px 8px; border-radius: 6px;">
              <i class="fa-solid fa-shield-halved" style="font-size: 13px; color: #64748b;"></i>
              <span style="font-size: 0.75rem; font-weight: 600; color: #475569;">Role:</span>
              <select
                id="role-switcher"
                style="
                  border: none;
                  background-color: transparent;
                  font-size: 0.78rem;
                  font-weight: 600;
                  color: #0f172a;
                  outline: none;
                  cursor: pointer;
                "
              >
                <option value="control_center_operator" ${this.userRole === 'control_center_operator' ? 'selected' : ''}>Control Center Operator</option>
                <option value="health_worker" ${this.userRole === 'health_worker' ? 'selected' : ''}>ASHA / Frontline Health Worker</option>
                <option value="hospital_staff" ${this.userRole === 'hospital_staff' ? 'selected' : ''}>Hospital Emergency Staff</option>
                <option value="citizen" ${this.userRole === 'citizen' ? 'selected' : ''}>Rural Citizen / Bystander</option>
              </select>
            </div>

            <!-- Language Switcher -->
            <div style="display: flex; align-items: center; gap: 4px;">
              <i class="fa-solid fa-globe" style="font-size: 13px; color: #64748b;"></i>
              <button
                type="button"
                id="btn-lang-toggle"
                class="btn-secondary"
                style="font-size: 0.75rem; padding: 4px 8px;"
              >
                ${this.language === 'en' ? 'हिंदी' : 'English'}
              </button>
            </div>

            <!-- Reset / Seed Demo Scenario Button -->
            <button
              type="button"
              id="btn-reset-demo"
              class="btn-primary"
              style="
                font-size: 0.78rem;
                padding: 6px 12px;
                display: flex;
                align-items: center;
                gap: 6px;
                background-color: #0f172a;
              "
            >
              <i class="fa-solid fa-rotate" style="font-size: 11px;"></i>
              <span id="reset-demo-text">Reset Demo (Hospital A/B)</span>
            </button>
          </div>
        </header>

        <!-- Navigation Sub-header Tabs -->
        <nav style="
          background-color: #ffffff;
          border-bottom: 1px solid #e2e8f0;
          padding: 0 24px;
          display: flex;
          gap: 8px;
          overflow-x: auto;
        ">
          ${this.tabs.map((tab) => `
            <button
              type="button"
              class="js-nav-tab"
              data-tab="${tab.id}"
              style="
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 12px 14px;
                border: none;
                background: none;
                border-bottom: 3px solid ${this.activeTab === tab.id ? '#1e40af' : 'transparent'};
                color: ${this.activeTab === tab.id ? '#1e40af' : '#64748b'};
                font-weight: ${this.activeTab === tab.id ? 700 : 500};
                font-size: 0.85rem;
                border-radius: 0;
                cursor: pointer;
                white-space: nowrap;
              "
            >
              <i class="${tab.icon}"></i>
              ${tab.label}
            </button>
          `).join('')}
        </nav>

        <!-- Main Screen Content Mount Point -->
        <main id="screen-container" style="flex: 1; padding: 20px 24px;"></main>

        <!-- Footer Notice -->
        <footer style="
          padding: 12px 24px;
          background-color: #ffffff;
          border-top: 1px solid #e2e8f0;
          font-size: 0.75rem;
          color: #64748b;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
        ">
          <div>
            <strong>LIFEGRID SIH26133:</strong> Rural & Underserved Healthcare Accessibility. Deterministic AI Triage with mandatory explainability traces and clinical override path.
          </div>
          <div>
            Status: <strong>Operational Monolith</strong>
          </div>
        </footer>
      </div>
    `;
  }

  bindShellEvents() {
    // Role switcher
    const roleSelect = this.root.querySelector('#role-switcher');
    if (roleSelect) {
      roleSelect.addEventListener('change', (e) => {
        this.userRole = e.target.value;
      });
    }

    // Language toggle
    const langBtn = this.root.querySelector('#btn-lang-toggle');
    if (langBtn) {
      langBtn.addEventListener('click', () => {
        this.language = this.language === 'en' ? 'hi' : 'en';
        langBtn.textContent = this.language === 'en' ? 'हिंदी' : 'English';
        if (this.activeTab === 'citizen-emergency' && this.activeScreenInstance?.setLanguage) {
          this.activeScreenInstance.setLanguage(this.language);
        }
      });
    }

    // Demo reset button
    const resetBtn = this.root.querySelector('#btn-reset-demo');
    const resetText = this.root.querySelector('#reset-demo-text');
    if (resetBtn) {
      resetBtn.addEventListener('click', async () => {
        try {
          this.isResetting = true;
          if (resetText) resetText.textContent = 'Seeding...';
          resetBtn.disabled = true;
          await resetDemoScenario();
          await this.loadData();
          alert('Demo scenarios seeded successfully: Hospital A/B Cardiac Emergency, 3-Tier Referral Chain, and SMS Low-Connectivity Incident initialized.');
        } catch (err) {
          alert(err.message || 'Failed to reset demo');
        } finally {
          this.isResetting = false;
          if (resetText) resetText.textContent = 'Reset Demo (Hospital A/B)';
          resetBtn.disabled = false;
        }
      });
    }

    // Tab buttons
    this.root.querySelectorAll('.js-nav-tab').forEach((tabBtn) => {
      tabBtn.addEventListener('click', () => {
        const tabId = tabBtn.getAttribute('data-tab');
        this.switchTab(tabId);
      });
    });
  }

  switchTab(tabId) {
    // Cleanup previous screen instance if any
    if (this.activeScreenInstance && typeof this.activeScreenInstance.destroy === 'function') {
      this.activeScreenInstance.destroy();
    }
    this.activeScreenInstance = null;

    this.activeTab = tabId;

    // Update tab bar UI
    this.root.querySelectorAll('.js-nav-tab').forEach((btn) => {
      const isActive = btn.getAttribute('data-tab') === tabId;
      btn.style.borderBottom = isActive ? '3px solid #1e40af' : '3px solid transparent';
      btn.style.color = isActive ? '#1e40af' : '#64748b';
      btn.style.fontWeight = isActive ? 700 : 500;
    });

    const mountPoint = this.root.querySelector('#screen-container');
    if (!mountPoint) return;
    mountPoint.innerHTML = '';

    const onRefresh = () => this.loadData();

    switch (tabId) {
      case 'control-center': {
        const screen = createControlCenterScreen({
          overviewData: this.overviewData,
          onRefresh,
          userRole: this.userRole,
        });
        this.activeScreenInstance = screen;
        mountPoint.appendChild(screen.element);
        break;
      }
      case 'citizen-emergency': {
        const screen = createCitizenEmergencyScreen({
          language: this.language,
        });
        this.activeScreenInstance = screen;
        mountPoint.appendChild(screen.element);
        break;
      }
      case 'hospital-dashboard': {
        const screen = createHospitalDashboardScreen();
        this.activeScreenInstance = screen;
        mountPoint.appendChild(screen.element);
        break;
      }
      case 'ambulance-fleet': {
        const screen = createAmbulanceFleetScreen();
        this.activeScreenInstance = screen;
        mountPoint.appendChild(screen);
        break;
      }
      case 'routine-triage': {
        const screen = createRoutineTriageScreen({
          userRole: this.userRole,
        });
        this.activeScreenInstance = screen;
        mountPoint.appendChild(screen);
        break;
      }
      case 'hospital-pre-alert': {
        const screen = createHospitalPreAlertScreen({
          hospitalId: 'hosp-b-district',
        });
        this.activeScreenInstance = screen;
        mountPoint.appendChild(screen.element);
        break;
      }
      case 'referral-tracker': {
        const screen = createReferralTrackerScreen({
          referrals: this.overviewData?.referrals || [],
          onRefresh,
          userRole: this.userRole,
        });
        this.activeScreenInstance = screen;
        mountPoint.appendChild(screen.element);
        break;
      }
      case 'offline-simulator': {
        const screen = createOfflineSimulatorScreen({
          onRefresh,
        });
        this.activeScreenInstance = screen;
        mountPoint.appendChild(screen);
        break;
      }
      default:
        mountPoint.innerHTML = `<div>Unknown tab: ${tabId}</div>`;
    }
  }
}

// Bootstrap once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('root') || document.getElementById('app');
  if (root) {
    new LifeGridApp(root);
  }
});
