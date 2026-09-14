import { reportEmergency } from '../intake/index.js';

// In-memory buffer of outbound simulated and live SMS messages
const outboundSMSLog = [];

// Gateway runtime configuration (can be populated via .env or UI)
const gatewayConfig = {
  provider: process.env.SMS_PROVIDER || 'auto', // 'fast2sms', 'twilio', 'webhook', or 'simulated'
  fast2sms_api_key: process.env.FAST2SMS_API_KEY || '',
  twilio_account_sid: process.env.TWILIO_ACCOUNT_SID || '',
  twilio_auth_token: process.env.TWILIO_AUTH_TOKEN || '',
  twilio_from: process.env.TWILIO_PHONE_NUMBER || '',
  webhook_url: process.env.SMS_WEBHOOK_URL || '',
};

export function getGatewayConfig() {
  return {
    provider: gatewayConfig.provider,
    fast2sms_configured: Boolean(gatewayConfig.fast2sms_api_key),
    twilio_configured: Boolean(gatewayConfig.twilio_account_sid && gatewayConfig.twilio_auth_token),
    webhook_configured: Boolean(gatewayConfig.webhook_url),
  };
}

export function updateGatewayConfig(newConfig = {}) {
  if (newConfig.provider) gatewayConfig.provider = newConfig.provider;
  if (newConfig.fast2sms_api_key !== undefined) gatewayConfig.fast2sms_api_key = newConfig.fast2sms_api_key;
  if (newConfig.twilio_account_sid !== undefined) gatewayConfig.twilio_account_sid = newConfig.twilio_account_sid;
  if (newConfig.twilio_auth_token !== undefined) gatewayConfig.twilio_auth_token = newConfig.twilio_auth_token;
  if (newConfig.twilio_from !== undefined) gatewayConfig.twilio_from = newConfig.twilio_from;
  if (newConfig.webhook_url !== undefined) gatewayConfig.webhook_url = newConfig.webhook_url;
  return getGatewayConfig();
}

export async function sendCarrierSMS(to, body) {
  let deliveryStatus = 'Simulated Carrier Dispatch';
  let errorDetails = null;

  // 1. Try Fast2SMS (Indian Mobile SMS Provider)
  if (
    (gatewayConfig.provider === 'fast2sms' || gatewayConfig.provider === 'auto') &&
    gatewayConfig.fast2sms_api_key
  ) {
    try {
      const cleanPhone = to.replace(/\D/g, '').slice(-10);
      if (cleanPhone.length === 10) {
        const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            'authorization': gatewayConfig.fast2sms_api_key,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            route: 'q',
            message: body,
            flash: 0,
            numbers: cleanPhone,
          }),
        });
        const data = await res.json();
        if (data.return) {
          deliveryStatus = 'Delivered (Fast2SMS Live Carrier)';
          return { deliveryStatus, errorDetails: null };
        } else {
          errorDetails = data.message || 'Fast2SMS error';
        }
      }
    } catch (e) {
      errorDetails = e.message;
    }
  }

  // 2. Try Twilio (International & Indian standard SMS)
  if (
    (gatewayConfig.provider === 'twilio' || gatewayConfig.provider === 'auto') &&
    gatewayConfig.twilio_account_sid &&
    gatewayConfig.twilio_auth_token &&
    gatewayConfig.twilio_from
  ) {
    try {
      const auth = Buffer.from(
        `${gatewayConfig.twilio_account_sid}:${gatewayConfig.twilio_auth_token}`
      ).toString('base64');
      const params = new URLSearchParams();
      params.append('To', to);
      params.append('From', gatewayConfig.twilio_from);
      params.append('Body', body);

      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${gatewayConfig.twilio_account_sid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        }
      );
      const data = await res.json();
      if (res.ok && data.sid) {
        deliveryStatus = `Delivered (Twilio Live Carrier: ${data.sid.slice(0, 10)}...)`;
        return { deliveryStatus, errorDetails: null };
      } else {
        errorDetails = data.message || res.statusText;
      }
    } catch (e) {
      errorDetails = e.message;
    }
  }

  // 3. Try Webhook Gateway
  if (gatewayConfig.webhook_url) {
    try {
      await fetch(gatewayConfig.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, body, timestamp: new Date().toISOString() }),
      });
      deliveryStatus = 'Dispatched (Custom Webhook Gateway)';
      return { deliveryStatus, errorDetails: null };
    } catch (e) {
      errorDetails = e.message;
    }
  }

  return { deliveryStatus, errorDetails };
}

export function getOutboundSMSLog() {
  return [...outboundSMSLog];
}

export function logOutboundSMS(to, body, type = 'status_update') {
  // Generate native device URI so user on mobile/desktop can tap to send directly via GSM messenger
  const cleanPhone = to.replace(/[^\d+]/g, '');
  const encodedBody = encodeURIComponent(body);
  const deviceSmsUri = `sms:${cleanPhone}?body=${encodedBody}`;

  const msg = {
    id: `sms-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    to,
    body,
    timestamp: new Date().toISOString(),
    type,
    deliveryStatus: 'Carrier Dispatched (GSM / Radio Simulator)',
    errorDetails: null,
    deviceSmsUri,
  };
  outboundSMSLog.unshift(msg);
  if (outboundSMSLog.length > 100) outboundSMSLog.pop();

  console.log(`[SMS OUTBOUND TO ${to}]: ${body}`);

  // Trigger carrier dispatch in background if configured
  sendCarrierSMS(to, body)
    .then((res) => {
      msg.deliveryStatus = res.deliveryStatus;
      msg.errorDetails = res.errorDetails;
      console.log(`[SMS CARRIER STATUS ${to}]: ${res.deliveryStatus}`);
    })
    .catch(() => {});

  return msg;
}

export function sendDirectSMS(to, body) {
  return logOutboundSMS(to, body, 'manual_dispatch');
}

// Parse inbound SMS keywords into standard intake payload
// Format: "EMRG <SYMPTOMS> [LOC:<LAT,LON> or <VILLAGE>]"
export function parseInboundSMS(payload) {
  const text = payload.body.trim();

  let location = {
    latitude: 19.8762,
    longitude: 75.3433,
    address: 'Rural Cell Tower Coverage Zone',
  };

  let rawSymptoms = text;

  // Extract location tag if provided
  const locMatch = text.match(/LOC:([^\s]+)/i);
  if (locMatch) {
    const locStr = locMatch[1];
    if (locStr.includes(',')) {
      const [lat, lon] = locStr.split(',').map(Number);
      if (!isNaN(lat) && !isNaN(lon)) {
        location = { latitude: lat, longitude: lon, address: 'SMS Coordinate Beacon' };
      }
    } else {
      location.address = `Village ${locStr.replace(/_/g, ' ')}`;
    }
    rawSymptoms = text.replace(locMatch[0], '').replace(/^EMRG/i, '').trim();
  } else {
    rawSymptoms = text.replace(/^EMRG/i, '').trim();
  }

  if (!rawSymptoms) {
    rawSymptoms = 'Emergency reported via SMS without symptom details';
  }

  // Feed into standard pipeline
  const result = reportEmergency({
    reported_by: `sms:${payload.from}`,
    channel: 'sms',
    location,
    raw_symptoms: rawSymptoms,
  });

  // Render outbound plain-text SMS confirmation back to reporter
  const replyText = `[LIFEGRID ALERT] Emergency report #${result.incident.id.slice(0, 6)} received. Priority: ${result.triage.priority}. Best-fit facility: ${result.hospital_match?.selected_hospital?.name || 'Assigned'}. Ambulance dispatched: ${result.ambulance_match?.selected_ambulance?.vehicle_number || 'En route'}. ETA: ${result.route?.final_eta_minutes || '10'}m.`;
  logOutboundSMS(payload.from, replyText, 'status_update');

  return {
    normalized_incident: result.incident,
    triage_priority: result.triage.priority,
    outbound_reply_sms: replyText,
    full_result: result,
  };
}

// Parse inbound IVR numeric menu into standard intake payload
export function parseInboundIVR(payload) {
  let symptoms = 'Emergency reported via IVR';
  let checklist = [];

  switch (payload.keypad_digits.trim()) {
    case '1':
      symptoms = 'Critical chest pain, suspected acute cardiac event reported via IVR';
      checklist = ['crushing chest pain', 'cardiac'];
      break;
    case '2':
      symptoms = 'Severe road accident / trauma injury reported via IVR';
      checklist = ['major trauma', 'severe bleeding'];
      break;
    case '3':
      symptoms = 'Severe respiratory gasping / breathing compromise reported via IVR';
      checklist = ['cannot breathe'];
      break;
    default:
      symptoms = 'General rural medical emergency assistance requested via IVR';
      break;
  }

  const location = payload.cell_tower_loc || {
    latitude: 19.8762,
    longitude: 75.3433,
    address: 'Automated Cell Tower Triangulation',
  };

  const result = reportEmergency({
    reported_by: `ivr:${payload.caller_number}`,
    channel: 'ivr',
    location,
    raw_symptoms: symptoms,
    checklist_symptoms: checklist,
  });

  const replyText = `[LIFEGRID IVR DISPATCH] Audio menu selection (${payload.keypad_digits}) processed. Priority: ${result.triage.priority}. Dispatching nearest emergency responder.`;
  logOutboundSMS(payload.caller_number, replyText, 'status_update');

  return {
    normalized_incident: result.incident,
    triage_priority: result.triage.priority,
    outbound_reply_sms: replyText,
    full_result: result,
  };
}

// Outbound SMS template renderers for hospitals and health workers
export function renderHospitalPreAlertSMS(
  hospitalContact,
  incident,
  priority,
  etaMinutes
) {
  const body = `[LIFEGRID PRE-ALERT] INCOMING PRIORITY: ${priority}. ETA: ~${etaMinutes} MIN. Symptoms: ${incident.raw_symptoms.slice(0, 60)}. Please confirm bed & specialist readiness. Reply READY to acknowledge.`;
  logOutboundSMS(hospitalContact, body, 'pre_alert');
  return body;
}

export function renderReferralReminderSMS(
  patientContact,
  patientName,
  targetFacilityName,
  dueDate
) {
  const body = `[LIFEGRID CARE] Namaste ${patientName}. Your scheduled clinical follow-up at ${targetFacilityName} is on ${dueDate}. Please bring your LifeGrid digital referral card.`;
  logOutboundSMS(patientContact, body, 'referral_reminder');
  return body;
}
