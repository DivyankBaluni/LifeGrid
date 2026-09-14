// Badges Component (Vanilla ES6)

export function AccessibilityBadge(status) {
  switch (status) {
    case 'phc_functioning':
      return `
        <span class="badge-acc badge-acc-phc">
          <i class="fa-solid fa-shield-halved" style="font-size: 11px;"></i>
          PHC Functioning
        </span>
      `;
    case 'specialist_unavailable':
      return `
        <span class="badge-acc badge-acc-specialist">
          <i class="fa-solid fa-triangle-exclamation" style="font-size: 11px;"></i>
          Specialist Unavailable
        </span>
      `;
    case 'emergency_unavailable':
      return `
        <span class="badge-acc badge-acc-emergency">
          <i class="fa-solid fa-building" style="font-size: 11px;"></i>
          Emergency Care Full/Offline
        </span>
      `;
    case 'ambulance_available':
      return `
        <span class="badge-acc badge-acc-ambulance">
          <i class="fa-solid fa-truck-medical" style="font-size: 11px;"></i>
          Ambulance Stationed
        </span>
      `;
    case 'referral_required':
      return `
        <span class="badge-acc badge-acc-referral">
          <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 11px;"></i>
          Higher Referral Required
        </span>
      `;
    default:
      return `<span class="badge-acc">${status}</span>`;
  }
}

export function TriageBadge(priority) {
  switch (priority) {
    case 'P1':
      return `
        <span class="badge-triage badge-triage-p1" title="Immediate Life Threat">
          <i class="fa-solid fa-fire" style="font-size: 11px;"></i>
          P1 Immediate
        </span>
      `;
    case 'P2':
      return `
        <span class="badge-triage badge-triage-p2" title="Urgent, Time-Sensitive">
          P2 Urgent
        </span>
      `;
    case 'P3':
      return `
        <span class="badge-triage badge-triage-p3" title="Needs Care Soon">
          P3 Priority
        </span>
      `;
    case 'P4':
    default:
      return `
        <span class="badge-triage badge-triage-p4" title="Routine / Non-Urgent">
          P4 Routine
        </span>
      `;
  }
}

export function FacilityTierBadge(tier) {
  const labels = {
    sub_centre: 'Tier 1: Sub-Centre',
    phc: 'Tier 2: Primary Health Centre',
    rural_hospital: 'Tier 3: Rural Hospital / CHC',
    district_hospital: 'Tier 4: District Super-Specialty',
  };
  return `
    <span style="
      font-size: 0.72rem;
      font-weight: 600;
      color: #475569;
      background-color: #f1f5f9;
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    ">
      ${labels[tier] || tier}
    </span>
  `;
}
