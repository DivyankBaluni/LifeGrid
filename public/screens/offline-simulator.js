// Offline Simulator Screen (Vanilla ES6)
import {
  sendSimulatedSMS,
  sendSimulatedIVR,
  fetchOutboundSMSLogs,
  fetchGatewayConfig,
  saveGatewayConfig,
  sendDirectCarrierSMS,
} from '../api.js';

export function createOfflineSimulatorScreen({ onRefresh }) {
  const container = document.createElement('div');
  container.style.cssText = 'max-width: 960px; margin: 0 auto;';

  let phoneNumber = '+919876543210';
  let smsBody = 'EMRG severe chest pain LOC:30.3398,78.0644';
  let isSending = false;
  let outboundLogs = [];
  let gatewayConfig = { provider: 'auto' };
  let showConfigDrawer = false;
  let lastDispatchedAlert = null;

  // Web Audio API emergency chime
  const playChime = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {}
  };

  const render = () => {
    container.innerHTML = `
      <!-- Header -->
      <div style="
        background-color: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 16px 20px;
        margin-bottom: 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 12px;
        box-shadow: var(--shadow-sm);
      ">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="
            width: 42px;
            height: 42px;
            border-radius: 10px;
            background-color: #e0f2fe;
            color: #0369a1;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
          ">
            <i class="fa-solid fa-satellite-dish"></i>
          </div>
          <div>
            <h2 style="font-size: 1.15rem; font-weight: 800; color: #0f172a; margin: 0;">
              Zero-Connectivity / SMS & IVR Telephony Gateway
            </h2>
            <p style="font-size: 0.8rem; color: #64748b; margin: 3px 0 0 0;">
              Enables emergency dispatch over cellular SMS and IVR voice menus when internet data is unavailable.
            </p>
          </div>
        </div>

        <div style="display: flex; gap: 8px; align-items: center;">
          <button
            type="button"
            id="btn-toggle-gateway-config"
            class="btn-secondary"
            style="display: flex; align-items: center; gap: 6px; font-size: 0.8rem; padding: 6px 12px;"
          >
            <i class="fa-solid fa-gear"></i>
            Carrier Gateway Setup
          </button>
          <button
            type="button"
            id="btn-refresh-logs"
            class="btn-secondary"
            style="display: flex; align-items: center; gap: 6px; font-size: 0.8rem; padding: 6px 12px;"
          >
            <i class="fa-solid fa-rotate"></i>
            Refresh Logs
          </button>
        </div>
      </div>

      <!-- Optional Gateway Setup Drawer -->
      ${showConfigDrawer ? `
        <div style="
          background-color: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          padding: 18px 20px;
          margin-bottom: 20px;
          box-shadow: var(--shadow-sm);
        ">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <strong style="font-size: 0.92rem; color: #0f172a;">
              <i class="fa-solid fa-tower-cell" style="color: #0369a1; margin-right: 6px;"></i>
              Carrier Dispatch Configuration (Live Fast2SMS / Twilio / Device Link)
            </strong>
            <button type="button" id="btn-close-config" style="background: none; border: none; color: #64748b; cursor: pointer; font-size: 16px;">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <p style="font-size: 0.78rem; color: #64748b; margin-bottom: 14px; line-height: 1.4;">
            By default, LIFEGRID runs a high-fidelity local carrier loopback simulator and provides <strong>1-click native device SMS links</strong>. To dispatch real cellular SMS to actual phones across India, optionally enter Fast2SMS or Twilio API keys below:
          </p>

          <form id="gateway-config-form" style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
            <div>
              <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #334155; margin-bottom: 4px;">
                SMS Provider Mode
              </label>
              <select
                id="cfg-provider"
                style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 0.82rem; background-color: #fff;"
              >
                <option value="auto" ${gatewayConfig.provider === 'auto' ? 'selected' : ''}>⚡ Auto (Fast2SMS / Twilio / Native Device SMS)</option>
                <option value="fast2sms" ${gatewayConfig.provider === 'fast2sms' ? 'selected' : ''}>🇮🇳 Fast2SMS (Indian Cellular Numbers)</option>
                <option value="twilio" ${gatewayConfig.provider === 'twilio' ? 'selected' : ''}>🌐 Twilio (International / Pan-India)</option>
                <option value="webhook" ${gatewayConfig.provider === 'webhook' ? 'selected' : ''}>🔗 Custom Webhook URL</option>
              </select>
            </div>

            <div>
              <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #334155; margin-bottom: 4px;">
                Fast2SMS API Authorization Key (Optional)
              </label>
              <input
                type="password"
                id="cfg-fast2sms"
                placeholder="Enter Fast2SMS API Key..."
                style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 0.82rem;"
              />
            </div>

            <div>
              <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #334155; margin-bottom: 4px;">
                Twilio Account SID (Optional)
              </label>
              <input
                type="text"
                id="cfg-twilio-sid"
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 0.82rem;"
              />
            </div>

            <div>
              <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #334155; margin-bottom: 4px;">
                Twilio Auth Token (Optional)
              </label>
              <input
                type="password"
                id="cfg-twilio-token"
                placeholder="Twilio Auth Token..."
                style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 0.82rem;"
              />
            </div>

            <div>
              <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #334155; margin-bottom: 4px;">
                Twilio Sender Phone Number (e.g. +14155552671)
              </label>
              <input
                type="text"
                id="cfg-twilio-from"
                placeholder="+1..."
                style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 0.82rem;"
              />
            </div>

            <div>
              <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #334155; margin-bottom: 4px;">
                Custom Webhook URL (Optional)
              </label>
              <input
                type="url"
                id="cfg-webhook-url"
                placeholder="https://..."
                style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 0.82rem;"
              />
            </div>

            <div style="grid-column: 1 / -1; display: flex; justify-content: flex-end; gap: 8px;">
              <button type="submit" class="btn-primary" style="padding: 8px 18px; font-size: 0.82rem;">
                Save Gateway Settings
              </button>
            </div>
          </form>
        </div>
      ` : ''}

      <!-- Last Outbound Dispatch Banner -->
      ${lastDispatchedAlert ? `
        <div style="
          background-color: #f0fdf4;
          border: 1.5px solid #86efac;
          border-radius: 12px;
          padding: 16px 20px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          animation: fadeIn 0.3s ease;
        ">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="
              width: 38px;
              height: 38px;
              background-color: #dcfce7;
              color: #15803d;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 18px;
            ">
              <i class="fa-solid fa-circle-check"></i>
            </div>
            <div>
              <strong style="font-size: 0.92rem; color: #166534; display: block;">
                Automated Dispatch Response Sent to ${lastDispatchedAlert.to}
              </strong>
              <span style="font-size: 0.78rem; color: #15803d; font-family: monospace;">
                ${lastDispatchedAlert.deliveryStatus || 'Carrier Network Dispatched'}
              </span>
            </div>
          </div>

          <div style="display: flex; gap: 8px; align-items: center;">
            <a
              href="${lastDispatchedAlert.deviceSmsUri || `sms:${lastDispatchedAlert.to}?body=${encodeURIComponent(lastDispatchedAlert.body)}`}"
              class="btn-primary"
              style="
                padding: 8px 14px;
                font-size: 0.8rem;
                display: flex;
                align-items: center;
                gap: 6px;
                text-decoration: none;
                background-color: #15803d;
              "
            >
              <i class="fa-solid fa-mobile-screen"></i>
              Open in Native SMS App
            </a>
          </div>
        </div>
      ` : ''}

      <div style="display: grid; grid-template-columns: 1.15fr 1fr; gap: 20px;">
        <!-- Left Column: Inbound SMS & IVR Simulator Controls -->
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <!-- SMS Simulator Card -->
          <div style="
            background-color: #ffffff;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            padding: 20px;
            box-shadow: var(--shadow-sm);
          ">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-message" style="font-size: 18px; color: #0369a1;"></i>
                <h3 style="font-size: 0.95rem; font-weight: 800; color: #0f172a; margin: 0;">
                  Inbound Carrier SMS Simulator
                </h3>
              </div>
              <span style="
                font-size: 0.72rem;
                font-weight: 700;
                color: #0369a1;
                background-color: #e0f2fe;
                padding: 2px 8px;
                border-radius: 6px;
              ">
                GSM / Satellite Telemetry
              </span>
            </div>

            <form id="sms-form">
              <div style="margin-bottom: 12px;">
                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #334155; margin-bottom: 4px;">
                  Reporter Phone Number (Receive real SMS reply here)
                </label>
                <input
                  type="text"
                  id="sms-phone"
                  value="${phoneNumber}"
                  placeholder="+91..."
                  style="
                    width: 100%;
                    padding: 9px 12px;
                    border-radius: 6px;
                    border: 1px solid #cbd5e1;
                    font-size: 0.85rem;
                    font-family: monospace;
                  "
                />
              </div>

              <div style="margin-bottom: 12px;">
                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #334155; margin-bottom: 4px;">
                  SMS Payload (Format: <code>EMRG &lt;Symptoms&gt; LOC:&lt;Lat,Lng or Village&gt;</code>)
                </label>
                <textarea
                  id="sms-text"
                  rows="3"
                  style="
                    width: 100%;
                    padding: 9px 12px;
                    border-radius: 6px;
                    border: 1px solid #cbd5e1;
                    font-size: 0.85rem;
                    font-family: monospace;
                    line-height: 1.4;
                  "
                >${smsBody}</textarea>
              </div>

              <!-- Presets -->
              <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px;">
                <span style="font-size: 0.72rem; color: #64748b; align-self: center; font-weight: 600;">Presets:</span>
                <button
                  type="button"
                  class="btn-secondary js-preset-sms"
                  data-preset="EMRG severe crushing chest pain LOC:30.3398,78.0644"
                  style="font-size: 0.72rem; padding: 3px 8px;"
                >
                  ❤️ Cardiac P1
                </button>
                <button
                  type="button"
                  class="btn-secondary js-preset-sms"
                  data-preset="EMRG compound leg fracture bleeding LOC:30.1342,78.2987"
                  style="font-size: 0.72rem; padding: 3px 8px;"
                >
                  🚗 Highway Trauma
                </button>
                <button
                  type="button"
                  class="btn-secondary js-preset-sms"
                  data-preset="EMRG snake bite neurotoxin LOC:Village_Maletha"
                  style="font-size: 0.72rem; padding: 3px 8px;"
                >
                  🐍 Snakebite Rural
                </button>
              </div>

              <div style="display: flex; gap: 8px;">
                <button
                  type="submit"
                  id="btn-submit-sms"
                  class="btn-primary"
                  ${isSending ? 'disabled' : ''}
                  style="
                    flex: 1;
                    padding: 11px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    font-weight: 700;
                    font-size: 0.88rem;
                  "
                >
                  <i class="fa-solid fa-paper-plane"></i>
                  ${isSending ? 'Transmitting Inbound SMS...' : 'Transmit Inbound SMS'}
                </button>

                <!-- Direct Device Native SMS App Trigger -->
                <a
                  id="btn-open-device-sms"
                  href="sms:${phoneNumber}?body=${encodeURIComponent(smsBody)}"
                  class="btn-secondary"
                  title="Open in your device's native messaging application"
                  style="
                    padding: 11px 16px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.85rem;
                    font-weight: 700;
                    text-decoration: none;
                    white-space: nowrap;
                  "
                >
                  <i class="fa-solid fa-mobile-screen"></i>
                  Device App
                </a>
              </div>
            </form>
          </div>

          <!-- IVR Audio Keypad Simulator -->
          <div style="
            background-color: #ffffff;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            padding: 20px;
            box-shadow: var(--shadow-sm);
          ">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <i class="fa-solid fa-phone" style="font-size: 18px; color: #15803d;"></i>
              <h3 style="font-size: 0.95rem; font-weight: 800; color: #0f172a; margin: 0;">
                Missed-Call Callback & IVR Keypad Menu
              </h3>
            </div>
            <p style="font-size: 0.78rem; color: #64748b; margin-bottom: 14px;">
              When citizen dials 108 with weak bandwidth, IVR calls back and prompts keypad triage:
            </p>

            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
              <button
                type="button"
                class="js-ivr-btn"
                data-digit="1"
                ${isSending ? 'disabled' : ''}
                style="
                  padding: 12px 8px;
                  border-radius: 8px;
                  border: 1px solid #cbd5e1;
                  background-color: #f8fafc;
                  text-align: center;
                  cursor: pointer;
                "
              >
                <div style="font-size: 1.25rem; font-weight: 800; color: #b91c1c;">1</div>
                <div style="font-size: 0.72rem; color: #0f172a; font-weight: 700;">Cardiac / Stroke</div>
              </button>

              <button
                type="button"
                class="js-ivr-btn"
                data-digit="2"
                ${isSending ? 'disabled' : ''}
                style="
                  padding: 12px 8px;
                  border-radius: 8px;
                  border: 1px solid #cbd5e1;
                  background-color: #f8fafc;
                  text-align: center;
                  cursor: pointer;
                "
              >
                <div style="font-size: 1.25rem; font-weight: 800; color: #ea580c;">2</div>
                <div style="font-size: 0.72rem; color: #0f172a; font-weight: 700;">Trauma / Fracture</div>
              </button>

              <button
                type="button"
                class="js-ivr-btn"
                data-digit="3"
                ${isSending ? 'disabled' : ''}
                style="
                  padding: 12px 8px;
                  border-radius: 8px;
                  border: 1px solid #cbd5e1;
                  background-color: #f8fafc;
                  text-align: center;
                  cursor: pointer;
                "
              >
                <div style="font-size: 1.25rem; font-weight: 800; color: #0284c7;">3</div>
                <div style="font-size: 0.72rem; color: #0f172a; font-weight: 700;">Gasping / Airway</div>
              </button>
            </div>
          </div>
        </div>

        <!-- Right Column: Outbound SMS Feed & Real Carrier Dispatch Records -->
        <div style="
          background-color: #ffffff;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          box-shadow: var(--shadow-sm);
          overflow: hidden;
        ">
          <div style="
            padding: 14px 18px;
            border-bottom: 1px solid #e2e8f0;
            background-color: #0f172a;
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: space-between;
          ">
            <div style="display: flex; align-items: center; gap: 8px;">
              <i class="fa-solid fa-terminal" style="font-size: 15px; color: #38bdf8;"></i>
              <span style="font-size: 0.85rem; font-weight: 700; font-family: monospace;">
                CARRIER OUTBOUND SMS FEED (${outboundLogs.length})
              </span>
            </div>
            <span style="
              font-size: 0.7rem;
              background-color: rgba(56, 189, 248, 0.2);
              color: #38bdf8;
              padding: 2px 8px;
              border-radius: 4px;
              font-family: monospace;
            ">
              LIVE CARRIER DISPATCH
            </span>
          </div>

          <div id="sms-logs-container" style="flex: 1; padding: 14px; overflow-y: auto; max-height: 520px; background-color: #f8fafc;">
            ${outboundLogs.length === 0 ? `
              <div style="color: #94a3b8; font-size: 0.82rem; text-align: center; padding: 50px 20px;">
                <i class="fa-solid fa-envelope-open-text" style="font-size: 32px; color: #cbd5e1; margin-bottom: 10px; display: block;"></i>
                No outbound SMS messages dispatched yet.<br/>
                Transmit an emergency report on the left to see the automated confirmation SMS.
              </div>
            ` : outboundLogs.map((log) => `
              <div style="
                background-color: #ffffff;
                border: 1px solid #e2e8f0;
                border-left: 4px solid #0284c7;
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 12px;
                box-shadow: var(--shadow-sm);
              ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <strong style="color: #0f172a; font-size: 0.82rem; font-family: monospace;">
                      To: ${log.to}
                    </strong>
                    <span style="
                      font-size: 0.68rem;
                      font-weight: 700;
                      color: #15803d;
                      background-color: #f0fdf4;
                      padding: 1px 6px;
                      border-radius: 4px;
                      border: 1px solid #bbf7d0;
                    ">
                      ${log.deliveryStatus || 'Carrier Dispatched'}
                    </span>
                  </div>
                  <span style="color: #94a3b8; font-size: 0.72rem;">
                    ${new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                <p style="
                  font-size: 0.8rem;
                  color: #1e293b;
                  font-family: monospace;
                  line-height: 1.4;
                  margin: 0 0 8px 0;
                  background-color: #f1f5f9;
                  padding: 8px 10px;
                  border-radius: 6px;
                ">
                  ${log.body}
                </p>

                <div style="display: flex; justify-content: flex-end; gap: 6px;">
                  <a
                    href="${log.deviceSmsUri || `sms:${log.to}?body=${encodeURIComponent(log.body)}`}"
                    class="btn-secondary"
                    target="_blank"
                    style="
                      font-size: 0.72rem;
                      padding: 3px 8px;
                      display: flex;
                      align-items: center;
                      gap: 4px;
                      text-decoration: none;
                    "
                  >
                    <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 10px;"></i>
                    Send to Phone via Native App
                  </a>
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
    const refreshBtn = container.querySelector('#btn-refresh-logs');
    if (refreshBtn) refreshBtn.addEventListener('click', loadLogs);

    const toggleCfgBtn = container.querySelector('#btn-toggle-gateway-config');
    if (toggleCfgBtn) {
      toggleCfgBtn.addEventListener('click', () => {
        showConfigDrawer = !showConfigDrawer;
        render();
      });
    }

    const closeCfgBtn = container.querySelector('#btn-close-config');
    if (closeCfgBtn) {
      closeCfgBtn.addEventListener('click', () => {
        showConfigDrawer = false;
        render();
      });
    }

    // Config form save
    const cfgForm = container.querySelector('#gateway-config-form');
    if (cfgForm) {
      cfgForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const provider = container.querySelector('#cfg-provider')?.value;
        const fast2sms = container.querySelector('#cfg-fast2sms')?.value;
        const twilioSid = container.querySelector('#cfg-twilio-sid')?.value;
        const twilioToken = container.querySelector('#cfg-twilio-token')?.value;
        const twilioFrom = container.querySelector('#cfg-twilio-from')?.value;
        const webhookUrl = container.querySelector('#cfg-webhook-url')?.value;

        try {
          await saveGatewayConfig({
            provider,
            fast2sms_api_key: fast2sms || undefined,
            twilio_account_sid: twilioSid || undefined,
            twilio_auth_token: twilioToken || undefined,
            twilio_from: twilioFrom || undefined,
            webhook_url: webhookUrl || undefined,
          });
          showConfigDrawer = false;
          alert('Carrier Gateway settings saved successfully.');
          render();
        } catch (err) {
          alert('Failed to save gateway config');
        }
      });
    }

    // Presets
    container.querySelectorAll('.js-preset-sms').forEach((btn) => {
      btn.addEventListener('click', () => {
        const text = btn.getAttribute('data-preset');
        const txtArea = container.querySelector('#sms-text');
        const deviceLink = container.querySelector('#btn-open-device-sms');
        if (txtArea) {
          txtArea.value = text;
          smsBody = text;
          if (deviceLink) {
            deviceLink.href = `sms:${phoneNumber}?body=${encodeURIComponent(text)}`;
          }
        }
      });
    });

    const phoneInput = container.querySelector('#sms-phone');
    const textInput = container.querySelector('#sms-text');
    const deviceLink = container.querySelector('#btn-open-device-sms');

    if (phoneInput) {
      phoneInput.addEventListener('input', (e) => {
        phoneNumber = e.target.value.trim();
        if (deviceLink) {
          deviceLink.href = `sms:${phoneNumber}?body=${encodeURIComponent(smsBody)}`;
        }
      });
    }

    if (textInput) {
      textInput.addEventListener('input', (e) => {
        smsBody = e.target.value.trim();
        if (deviceLink) {
          deviceLink.href = `sms:${phoneNumber}?body=${encodeURIComponent(smsBody)}`;
        }
      });
    }

    // Submit SMS Form
    const form = container.querySelector('#sms-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        phoneNumber = phoneInput ? phoneInput.value.trim() : phoneNumber;
        smsBody = textInput ? textInput.value.trim() : smsBody;
        if (!smsBody) return;

        try {
          isSending = true;
          render();
          const res = await sendSimulatedSMS(phoneNumber, smsBody);
          playChime();
          lastDispatchedAlert = {
            to: phoneNumber,
            body: res.outbound_reply_sms,
            deliveryStatus: res.full_result?.ambulance_match ? 'Dispatched to Nearest Ambulance Crew & Hospital' : 'Carrier Dispatched',
            deviceSmsUri: `sms:${phoneNumber}?body=${encodeURIComponent(res.outbound_reply_sms || '')}`,
          };
          await loadLogs();
          if (onRefresh) onRefresh();
        } catch (err) {
          alert(err.message || 'Failed to simulate SMS');
        } finally {
          isSending = false;
          render();
        }
      });
    }

    // IVR Keypad Buttons
    container.querySelectorAll('.js-ivr-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const digits = btn.getAttribute('data-digit');
        phoneNumber = phoneInput ? phoneInput.value.trim() : phoneNumber;

        try {
          isSending = true;
          render();
          const res = await sendSimulatedIVR(phoneNumber, digits);
          playChime();
          lastDispatchedAlert = {
            to: phoneNumber,
            body: res.outbound_reply_sms,
            deliveryStatus: 'IVR Keypad Call Back Alert Dispatched',
            deviceSmsUri: `sms:${phoneNumber}?body=${encodeURIComponent(res.outbound_reply_sms || '')}`,
          };
          await loadLogs();
          if (onRefresh) onRefresh();
        } catch (err) {
          alert(err.message || 'Failed to simulate IVR');
        } finally {
          isSending = false;
          render();
        }
      });
    });
  };

  const loadLogs = async () => {
    try {
      outboundLogs = await fetchOutboundSMSLogs();
      const cfg = await fetchGatewayConfig().catch(() => ({ provider: 'auto' }));
      gatewayConfig = cfg;
    } catch (e) {
      console.error(e);
    }
  };

  loadLogs().then(() => render());
  return container;
}
