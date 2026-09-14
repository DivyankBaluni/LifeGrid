// National Ambulance Fleet Telemetry & 3D Diagnostics Screen (Vanilla ES6)
import { fetchPanIndiaAmbulances } from '../api.js';
import { openAmbulance3DViewer } from '../components/ambulance-3d-viewer.js';

export function createAmbulanceFleetScreen() {
  const container = document.createElement('div');
  container.style.cssText = 'display: flex; flex-direction: column; gap: 20px;';

  let ambulances = [];
  let filterType = 'all';
  let searchDistrict = '';

  const render = () => {
    const filtered = ambulances.filter((a) => {
      const matchesType = filterType === 'all' || a.type === filterType;
      const matchesDist = !searchDistrict || (a.district || '').toLowerCase().includes(searchDistrict.toLowerCase());
      return matchesType && matchesDist;
    });

    container.innerHTML = `
      <!-- Top Controls Header -->
      <div style="
        background-color: #ffffff;
        border-radius: 12px;
        border: 1px solid #e2e8f0;
        padding: 16px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
        box-shadow: var(--shadow-sm);
      ">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="
            width: 40px;
            height: 40px;
            background-color: #fee2e2;
            color: #dc2626;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
          ">
            <i class="fa-solid fa-truck-medical"></i>
          </div>
          <div>
            <h2 style="font-size: 1.2rem; font-weight: 800; color: #0f172a; margin: 0;">
              National Emergency Fleet Telemetry & 3D Diagnostics
            </h2>
            <p style="font-size: 0.75rem; color: #64748b; margin: 3px 0 0 0;">
              Monitoring 32 Advanced Life Support, Mobile ICU, and Basic Life Support units across India
            </p>
          </div>
        </div>

        <!-- Filters -->
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <input
            type="text"
            id="fleet-search-district"
            placeholder="Filter by district (e.g. Pune, Dehradun)..."
            value="${searchDistrict}"
            style="
              font-size: 0.8rem;
              padding: 6px 12px;
              border-radius: 6px;
              border: 1px solid #cbd5e1;
              outline: none;
            "
          />
          <select
            id="fleet-filter-type"
            style="
              font-size: 0.8rem;
              padding: 6px 10px;
              border-radius: 6px;
              border: 1px solid #cbd5e1;
              background-color: #ffffff;
              font-weight: 600;
              color: #334155;
            "
          >
            <option value="all" ${filterType === 'all' ? 'selected' : ''}>All Vehicle Classes</option>
            <option value="ALS" ${filterType === 'ALS' ? 'selected' : ''}>ALS — Advanced Life Support</option>
            <option value="MICU" ${filterType === 'MICU' ? 'selected' : ''}>MICU — Mobile ICU</option>
            <option value="BLS" ${filterType === 'BLS' ? 'selected' : ''}>BLS — Basic Life Support</option>
            <option value="NEO" ${filterType === 'NEO' ? 'selected' : ''}>NEO — Neonatal Transport</option>
          </select>
        </div>
      </div>

      <!-- Ambulance Grid -->
      <div style="
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 16px;
      ">
        ${filtered.map((amb) => {
          const isAvailable = amb.status === 'available';
          const typeBadgeColor =
            amb.type === 'MICU'
              ? '#7e22ce'
              : amb.type === 'ALS'
              ? '#dc2626'
              : amb.type === 'NEO'
              ? '#ea580c'
              : '#2563eb';

          return `
            <div style="
              background-color: #ffffff;
              border-radius: 12px;
              border: 1px solid #e2e8f0;
              padding: 16px;
              box-shadow: var(--shadow-sm);
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              position: relative;
            ">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                  <div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span style="font-size: 1rem; font-weight: 800; color: #0f172a;">
                        ${amb.name}
                      </span>
                      <span style="
                        font-size: 0.65rem;
                        font-weight: 800;
                        background-color: ${typeBadgeColor}15;
                        color: ${typeBadgeColor};
                        border: 1px solid ${typeBadgeColor}40;
                        padding: 2px 6px;
                        border-radius: 4px;
                      ">
                        ${amb.type}
                      </span>
                    </div>
                    <div style="font-size: 0.72rem; color: #64748b; margin-top: 2px;">
                      ${amb.type_label || amb.type} · Plate: <strong>${amb.license_plate}</strong>
                    </div>
                  </div>

                  <span style="
                    font-size: 0.68rem;
                    font-weight: 700;
                    background-color: ${isAvailable ? '#dcfce7' : '#fee2e2'};
                    color: ${isAvailable ? '#15803d' : '#b91c1c'};
                    padding: 3px 8px;
                    border-radius: 6px;
                    border: 1px solid ${isAvailable ? '#86efac' : '#fca5a5'};
                  ">
                    ${isAvailable ? 'AVAILABLE' : 'DISPATCHED'}
                  </span>
                </div>

                <div style="font-size: 0.78rem; color: #334155; display: flex; flex-direction: column; gap: 4px; margin: 10px 0;">
                  <div>
                    📍 Base District: <strong>${amb.district}</strong> ${amb.state ? `(${amb.state})` : ''}
                  </div>
                  <div>
                    👨‍✈️ Driver: <strong>${amb.driver}</strong> (${amb.driver_phone})
                  </div>
                  <div>
                    🩺 Paramedic / Crew: <strong>${amb.paramedic}</strong> · Cap: <strong>${amb.capacity} patients</strong>
                  </div>
                </div>

                <div style="font-size: 0.72rem; color: #64748b; margin-bottom: 12px;">
                  <strong>Key Equipment:</strong>
                  ${(amb.equipment || []).slice(0, 4).join(', ')}...
                </div>
              </div>

              <!-- Action: Open 3D Inspector -->
              <button
                type="button"
                class="js-inspect-3d"
                data-id="${amb.id}"
                style="
                  background-color: #0f172a;
                  color: #ffffff;
                  border: none;
                  border-radius: 8px;
                  padding: 8px 14px;
                  font-size: 0.78rem;
                  font-weight: 700;
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 6px;
                  transition: background 0.2s;
                "
              >
                <i class="fa-solid fa-box" style="color: #38bdf8;"></i>
                Inspect 3D Ambulance Model
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `;

    bindEvents();
  };

  const bindEvents = () => {
    const sInput = container.querySelector('#fleet-search-district');
    if (sInput) {
      sInput.addEventListener('input', (e) => {
        searchDistrict = e.target.value;
        render();
        // preserve focus
        const nextInput = container.querySelector('#fleet-search-district');
        if (nextInput) {
          nextInput.focus();
          nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length);
        }
      });
    }

    const fSelect = container.querySelector('#fleet-filter-type');
    if (fSelect) {
      fSelect.addEventListener('change', (e) => {
        filterType = e.target.value;
        render();
      });
    }

    container.querySelectorAll('.js-inspect-3d').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const amb = ambulances.find((a) => a.id === id);
        if (amb) openAmbulance3DViewer(amb);
      });
    });
  };

  const loadFleet = async () => {
    try {
      ambulances = await fetchPanIndiaAmbulances();
      render();
    } catch (err) {
      console.error('Failed to load ambulance fleet:', err);
    }
  };

  loadFleet();
  return container;
}
