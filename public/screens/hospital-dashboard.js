// Hospital Bed Matrix Dashboard Screen (Vanilla ES6)
import { socket } from '../api.js';

export function createHospitalDashboardScreen() {
  const container = document.createElement('div');
  container.style.cssText = 'display: flex; flex-direction: column; gap: 20px;';

  const hospitalId = 'hosp-b-district';
  const hospitalName = 'District Super-Specialty Medical Centre';
  const totalBeds = 40;

  let incomingAlerts = [
    {
      id: 'LGRD-901824',
      severity: 'CRITICAL',
      condition: 'Acute Myocardial Infarction / STEMI',
      patients: 1,
      eta_minutes: 8,
      ambulance_id: 'MH-20-AX-1088 (ALS)',
      needs: ['Cath Lab', 'Cardiologist', 'Defibrillator', 'Heparin'],
      time: 'Just now',
    },
  ];

  const bedStates = {};
  for (let i = 1; i <= 40; i++) {
    if (i <= 10) bedStates[i] = i <= 6 ? 'icu' : 'occupied';
    else bedStates[i] = i % 3 === 0 ? 'occupied' : 'available';
  }

  const render = () => {
    const availableCount = Object.values(bedStates).filter((s) => s === 'available').length;
    const occupiedCount = Object.values(bedStates).filter((s) => s === 'occupied').length;
    const icuCount = Object.values(bedStates).filter((s) => s === 'icu').length;

    container.innerHTML = `
      <!-- Top Header Card -->
      <div style="
        background-color: #ffffff;
        border-radius: 12px;
        border: 1px solid #e2e8f0;
        padding: 20px 24px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 16px;
        box-shadow: var(--shadow-sm);
      ">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="
            width: 44px;
            height: 44px;
            background-color: #eff6ff;
            color: #1e40af;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
          ">
            <i class="fa-solid fa-building"></i>
          </div>
          <div>
            <h2 style="font-size: 1.25rem; font-weight: 800; color: #0f172a; margin: 0;">
              ${hospitalName}
            </h2>
            <p style="font-size: 0.8rem; color: #64748b; margin: 4px 0 0 0;">
              Facility ID: <strong>${hospitalId}</strong> · Level 3 Super-Specialty District Hospital · Cath Lab & ICU Live
            </p>
          </div>
        </div>

        <!-- Live Bed Count Badges -->
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <div style="padding: 8px 14px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; text-align: center;">
            <div style="font-size: 1.2rem; font-weight: 800; color: #15803d;">${availableCount}</div>
            <div style="font-size: 0.7rem; color: #166534; font-weight: 600;">Available Beds</div>
          </div>
          <div style="padding: 8px 14px; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; text-align: center;">
            <div style="font-size: 1.2rem; font-weight: 800; color: #b91c1c;">${occupiedCount}</div>
            <div style="font-size: 0.7rem; color: #991b1b; font-weight: 600;">Occupied</div>
          </div>
          <div style="padding: 8px 14px; background-color: #faf5ff; border: 1px solid #e9d5ff; border-radius: 8px; text-align: center;">
            <div style="font-size: 1.2rem; font-weight: 800; color: #7e22ce;">${icuCount}</div>
            <div style="font-size: 0.7rem; color: #6b21a8; font-weight: 600;">ICU Active</div>
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px;">
        <!-- Left: Interactive Bed Status Management -->
        <div style="
          background-color: #ffffff;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          padding: 20px;
          box-shadow: var(--shadow-sm);
        ">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <div>
              <h3 style="font-size: 1rem; font-weight: 700; margin: 0; color: #0f172a;">
                🛏️ Live Bed Allocation Grid
              </h3>
              <p style="font-size: 0.75rem; color: #64748b; margin: 2px 0 0 0;">
                Click any bed cell to toggle state (Available 🟢 → Occupied 🔴 → ICU 🟣)
              </p>
            </div>
          </div>

          <div style="
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
            gap: 8px;
            padding: 10px 0;
          ">
            ${Array.from({ length: totalBeds }, (_, i) => i + 1).map((num) => {
              const st = bedStates[num] || 'available';
              const bg = st === 'available' ? '#dcfce7' : st === 'occupied' ? '#fee2e2' : '#f3e8ff';
              const border = st === 'available' ? '#86efac' : st === 'occupied' ? '#fca5a5' : '#d8b4fe';
              const textColor = st === 'available' ? '#166534' : st === 'occupied' ? '#991b1b' : '#6b21a8';
              const icon = st === 'available' ? '🛏️' : st === 'occupied' ? '⛔' : '🏥';

              return `
                <button
                  type="button"
                  class="js-toggle-bed"
                  data-bed="${num}"
                  style="
                    background-color: ${bg};
                    border: 1.5px solid ${border};
                    border-radius: 8px;
                    padding: 8px 4px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    cursor: pointer;
                    transition: all 0.15s ease;
                  "
                  title="Bed #${num}: ${st.toUpperCase()}"
                >
                  <span style="font-size: 0.9rem;">${icon}</span>
                  <span style="font-size: 0.68rem; font-weight: 700; color: ${textColor};">${num}</span>
                </button>
              `;
            }).join('')}
          </div>

          <div style="display: flex; gap: 16px; margin-top: 16px; font-size: 0.75rem; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 12px;">
            <span style="display: flex; align-items: center; gap: 5px;">
              <span style="width: 10px; height: 10px; border-radius: 3px; background-color: #86efac;"></span> Available
            </span>
            <span style="display: flex; align-items: center; gap: 5px;">
              <span style="width: 10px; height: 10px; border-radius: 3px; background-color: #fca5a5;"></span> Occupied
            </span>
            <span style="display: flex; align-items: center; gap: 5px;">
              <span style="width: 10px; height: 10px; border-radius: 3px; background-color: #d8b4fe;"></span> ICU Assigned
            </span>
          </div>
        </div>

        <!-- Right: Real-time Pre-Alerts & Incoming Emergencies -->
        <div style="
          background-color: #ffffff;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          padding: 20px;
          box-shadow: var(--shadow-sm);
          display: flex;
          flex-direction: column;
        ">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <div>
              <h3 style="font-size: 1rem; font-weight: 700; margin: 0; color: #0f172a;">
                🚨 Incoming Emergency Alerts (Real-Time)
              </h3>
              <p style="font-size: 0.75rem; color: #64748b; margin: 2px 0 0 0;">
                Automated telemetry from dispatch units en-route to this emergency room
              </p>
            </div>
            <span style="font-size: 0.75rem; font-weight: 700; color: #1e40af; background-color: #eff6ff; padding: 3px 8px; border-radius: 6px;">
              ${incomingAlerts.length} Active
            </span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px; overflow-y: auto; max-height: 420px;">
            ${incomingAlerts.map((alert) => `
              <div style="
                border: 1px solid #e2e8f0;
                border-radius: 10px;
                padding: 14px;
                background-color: ${alert.severity === 'CRITICAL' ? '#fef2f2' : '#fffbeb'};
                border-left: 4px solid ${alert.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b'};
              ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <span style="
                    font-size: 0.7rem;
                    font-weight: 800;
                    background-color: ${alert.severity === 'CRITICAL' ? '#b91c1c' : '#b45309'};
                    color: #ffffff;
                    padding: 2px 6px;
                    border-radius: 4px;
                  ">
                    ${alert.severity}
                  </span>
                  <span style="font-size: 0.75rem; font-weight: 700; color: #0f172a;">
                    ⏱️ ETA: ${alert.eta_minutes} min
                  </span>
                </div>
                <div style="font-size: 0.85rem; font-weight: 700; color: #0f172a; margin-bottom: 4px;">
                  ${alert.condition}
                </div>
                <div style="font-size: 0.75rem; color: #64748b; margin-bottom: 8px;">
                  Unit: <strong>${alert.ambulance_id}</strong> · Patients: ${alert.patients} · ${alert.time}
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                  ${(alert.needs || []).map((nd) => `
                    <span style="
                      font-size: 0.68rem;
                      background-color: #ffffff;
                      border: 1px solid #cbd5e1;
                      border-radius: 4px;
                      padding: 2px 6px;
                      font-weight: 600;
                      color: #334155;
                    ">
                      ✓ ${nd}
                    </span>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    bindEvents();
  };

  const bindEvents = () => {
    container.querySelectorAll('.js-toggle-bed').forEach((btn) => {
      btn.addEventListener('click', () => {
        const bedNum = parseInt(btn.getAttribute('data-bed'), 10);
        const current = bedStates[bedNum];
        bedStates[bedNum] = current === 'available' ? 'occupied' : current === 'occupied' ? 'icu' : 'available';
        render();
      });
    });
  };

  const handleNewIncident = (data) => {
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
      incomingAlerts = [newAlert, ...incomingAlerts];
      render();
    }
  };

  if (socket) {
    socket.on('incident:new', handleNewIncident);
  }

  render();

  return {
    element: container,
    destroy() {
      if (socket) {
        socket.off('incident:new', handleNewIncident);
      }
    },
  };
}
