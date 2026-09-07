import React from 'react';
import { Building2, AlertTriangle, ShieldCheck, Ambulance, ArrowUpRight, Flame } from 'lucide-react';

export const AccessibilityBadge: React.FC<{ status: string }> = ({ status }) => {
  switch (status) {
    case 'phc_functioning':
      return (
        <span className="badge-acc badge-acc-phc">
          <ShieldCheck size={12} />
          PHC Functioning
        </span>
      );
    case 'specialist_unavailable':
      return (
        <span className="badge-acc badge-acc-specialist">
          <AlertTriangle size={12} />
          Specialist Unavailable
        </span>
      );
    case 'emergency_unavailable':
      return (
        <span className="badge-acc badge-acc-emergency">
          <Building2 size={12} />
          Emergency Care Full/Offline
        </span>
      );
    case 'ambulance_available':
      return (
        <span className="badge-acc badge-acc-ambulance">
          <Ambulance size={12} />
          Ambulance Stationed
        </span>
      );
    case 'referral_required':
      return (
        <span className="badge-acc badge-acc-referral">
          <ArrowUpRight size={12} />
          Higher Referral Required
        </span>
      );
    default:
      return <span className="badge-acc">{status}</span>;
  }
};

export const TriageBadge: React.FC<{ priority: string }> = ({ priority }) => {
  switch (priority) {
    case 'P1':
      return (
        <span className="badge-triage badge-triage-p1" title="Immediate Life Threat">
          <Flame size={12} />
          P1 Immediate
        </span>
      );
    case 'P2':
      return (
        <span className="badge-triage badge-triage-p2" title="Urgent, Time-Sensitive">
          P2 Urgent
        </span>
      );
    case 'P3':
      return (
        <span className="badge-triage badge-triage-p3" title="Needs Care Soon">
          P3 Priority
        </span>
      );
    case 'P4':
    default:
      return (
        <span className="badge-triage badge-triage-p4" title="Routine / Non-Urgent">
          P4 Routine
        </span>
      );
  }
};

export const FacilityTierBadge: React.FC<{ tier: string }> = ({ tier }) => {
  const labels: Record<string, string> = {
    sub_centre: 'Tier 1: Sub-Centre',
    phc: 'Tier 2: Primary Health Centre',
    rural_hospital: 'Tier 3: Rural Hospital / CHC',
    district_hospital: 'Tier 4: District Super-Specialty',
  };
  return (
    <span style={{
      fontSize: '0.72rem',
      fontWeight: 600,
      color: '#475569',
      backgroundColor: '#f1f5f9',
      padding: '2px 6px',
      borderRadius: '4px',
      border: '1px solid #e2e8f0',
      textTransform: 'uppercase',
      letterSpacing: '0.02em',
    }}>
      {labels[tier] || tier}
    </span>
  );
};
