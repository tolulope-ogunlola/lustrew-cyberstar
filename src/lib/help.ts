// Contextual help shown in the Info side panel, keyed by route. Keep entries short and action-oriented.

export type HelpEntry = {
  title: string;
  intro: string;
  sections: { heading: string; items: string[] }[];
};

export const GETTING_STARTED: HelpEntry = {
  title: "Getting started",
  intro:
    "CyberStar centralizes ATO/A&A, RMF, and continuous-monitoring work. A typical flow: create a system, work its controls and evidence, import scans, track findings as POA&Ms and risks, then report.",
  sections: [
    {
      heading: "Orientation",
      items: [
        "The left sidebar groups work into Compliance and System areas — your role determines what you see.",
        "Open any system to get tabs for Controls, RMF, Evidence, Vulnerabilities, STIG, POA&Ms, Risks, and PPSM.",
        "Use the sun/moon button to switch light/dark; the bell shows continuous-monitoring alerts.",
      ],
    },
    {
      heading: "Tips",
      items: [
        "✨ AI-draft buttons produce review-ready text — always a draft, never a final decision.",
        "This Info panel updates to explain whichever page you're on.",
      ],
    },
  ],
};

// Keyed by NAV_META key (plus "account").
export const HELP: Record<string, HelpEntry> = {
  dashboard: {
    title: "Continuous Monitoring",
    intro: "A live snapshot of a system's authorization posture and the items that need attention.",
    sections: [
      { heading: "What you see", items: [
        "ATO readiness, control posture, RMF progress, and evidence completeness.",
        "Open/overdue POA&Ms, open critical/high vulnerabilities, and open risks.",
      ] },
      { heading: "Actions", items: [
        "Switch systems with the chips at the top.",
        "Generate an AI executive summary of the current posture.",
      ] },
    ],
  },
  copilot: {
    title: "AI Compliance Copilot",
    intro: "Ask grounded questions, run a gap analysis, and generate draft SSP/SAR documents — all from the selected system's data.",
    sections: [
      { heading: "Chat", items: [
        "Answers are grounded only in the chosen system's controls, POA&Ms, vulnerabilities, and risks.",
        "Source chips show which controls/POA&Ms informed the answer.",
      ] },
      { heading: "Gap Analysis", items: [
        "Detects unimplemented controls, missing evidence/narratives, overdue POA&Ms, and open findings/risks.",
        "Returns a prioritized path to ATO; gaps are computed deterministically, then narrated by AI.",
      ] },
      { heading: "Documents", items: [
        "Generate a draft System Security Plan or Security Assessment Report and download it as Markdown.",
        "Everything is a draft for human review — never a final authorization decision.",
      ] },
    ],
  },
  systems: {
    title: "Systems",
    intro: "Each system is an authorization boundary. Open one to work its full compliance lifecycle.",
    sections: [
      { heading: "Actions", items: [
        "Create a system, choosing its FIPS 199 category and applicable frameworks — controls and RMF steps are generated automatically.",
        "Open a system for tabs: Controls, RMF, Evidence, Vulnerabilities, STIG, POA&Ms, Risks, PPSM.",
      ] },
    ],
  },
  controls: {
    title: "NIST 800-53 Controls",
    intro: "Browse the control catalog; within a system, track each control's implementation.",
    sections: [
      { heading: "Per-system", items: [
        "Set status (implemented / partial / planned / not implemented / risk-accepted) and scoping.",
        "Write the SSP implementation statement, or ✨ AI-draft it from system + evidence context.",
        "Link evidence so the dashboard can score coverage.",
      ] },
    ],
  },
  crosswalks: {
    title: "Framework Crosswalks",
    intro: "See how NIST 800-53 control families line up with CMMC 2.0, ISO/IEC 27001:2022, and SOC 2.",
    sections: [
      { heading: "How to use", items: [
        "Search by family code (e.g. AC) or by a target reference to find equivalents.",
        "Use the mappings to scope reciprocity and reuse evidence across frameworks.",
        "Mappings are family-level aids — confirm individual control applicability before relying on them.",
      ] },
    ],
  },
  cmmc: {
    title: "CMMC Readiness",
    intro: "Track NIST SP 800-171 implementation, your SPRS score, and CUI asset scoping for a CMMC assessment.",
    sections: [
      { heading: "Getting started", items: [
        "Create a system with the CMMC Level 1/2 or NIST 800-171 framework — the 110 requirements (or the 17 L1 practices) generate automatically.",
        "Work each requirement on the system's Controls tab; status IMPLEMENTED counts as met.",
      ] },
      { heading: "What you see", items: [
        "SPRS score (DoD Assessment Methodology estimate, floor −203) and percent implemented.",
        "Coverage by 800-171 family with the related 800-53 family for evidence reuse.",
        "A prioritized gap list — highest SPRS point-impact first — showing what blocks your assessment.",
      ] },
      { heading: "Asset inventory", items: [
        "Categorize assets (CUI / Security Protection / Contractor Risk Managed / Specialized / Out of Scope) to define your assessment boundary.",
      ] },
    ],
  },
  evidence: {
    title: "Evidence Vault",
    intro: "Store artifacts (links or uploaded files) and map them to the controls they support.",
    sections: [
      { heading: "Actions", items: [
        "Add evidence by URL or upload a file (scanned for malware; PDF/image/Office/CSV up to 25 MB).",
        "Link each artifact to one or more control implementations.",
        "Downloads are authenticated and scoped to your organization.",
      ] },
    ],
  },
  vulnerabilities: {
    title: "Vulnerabilities",
    intro: "Import scanner output, triage by priority, and turn findings into tracked POA&Ms.",
    sections: [
      { heading: "Actions", items: [
        "Import a Nessus .nessus or ACAS/CSV scan; duplicates are merged automatically.",
        "Findings are prioritized by severity + CVSS and mapped to a likely NIST control.",
        "Set a finding's state, or convert it to a POA&M in one click.",
      ] },
    ],
  },
  stig: {
    title: "STIG Compliance",
    intro: "Import DISA .ckl checklists and track findings by CAT severity and status.",
    sections: [
      { heading: "Actions", items: [
        "Import a .ckl file; statuses (Open / Not a Finding / N/A / Not Reviewed) are preserved.",
        "Convert an open finding to a POA&M (defaults to control CM-6 with a CAT-based due date).",
      ] },
    ],
  },
  poams: {
    title: "POA&M Manager",
    intro: "Plan of Action & Milestones — track weaknesses to remediation with an auditable history.",
    sections: [
      { heading: "Actions", items: [
        "Create POA&Ms manually or from vulnerabilities/STIG findings.",
        "Add milestones, set severity and scheduled completion, and change status (recorded immutably).",
        "Overdue items surface on the dashboard and in notifications.",
      ] },
    ],
  },
  risks: {
    title: "Risk Register",
    intro: "Score risks on a 5×5 likelihood × impact matrix and manage treatment and acceptance.",
    sections: [
      { heading: "Actions", items: [
        "Capture inherent and residual likelihood/impact; the rating is computed for you.",
        "Use the heatmap to see concentration; formally accept a risk with an approval authority.",
      ] },
    ],
  },
  authorization: {
    title: "Assessment & Authorization",
    intro: "Run a Security Control Assessment (SCA), record the Authorizing Official's decision, and export OSCAL.",
    sections: [
      { heading: "Assessments (SCA)", items: [
        "Starting an assessment seeds a result row per applicable control, prefilled from its current status.",
        "Set each control to Satisfied / Other than satisfied / Not applicable and capture findings + recommendations.",
        "Mark the assessment complete once every applicable control is assessed; it then feeds the AI-generated SAR.",
      ] },
      { heading: "Authorization decisions", items: [
        "Record an ATO / ATO-with-conditions / IATT / Denied / Revoked decision with the AO, dates, rationale, and conditions.",
        "Decisions are immutable history and written to the audit log.",
      ] },
      { heading: "OSCAL export", items: [
        "Download OSCAL 1.1.2 SSP and assessment-results JSON for eMASS/RegScale and other OSCAL tools.",
        "Inherited/hybrid controls carry their common control provider as control-origination.",
      ] },
    ],
  },
  ppsm: {
    title: "PPSM",
    intro: "Ports, Protocols, and Services Management register for the system boundary.",
    sections: [
      { heading: "Actions", items: [
        "Add each port/protocol/service with direction, source/destination, and business justification.",
        "Track approval status; unapproved entries are highlighted.",
      ] },
    ],
  },
  policies: {
    title: "Policies & Governance",
    intro: "Your organization's policy library with versions, review status, and acknowledgements.",
    sections: [
      { heading: "Actions", items: [
        "Create policies, set framework/version and review date, and move them through review to approved.",
        "Acknowledge a policy to record that you've read it.",
      ] },
    ],
  },
  reports: {
    title: "Reports",
    intro: "Generate audit-ready exports for stakeholders and assessors.",
    sections: [
      { heading: "Actions", items: [
        "Pick a system, then export Executive, Controls, POA&M, Vulnerability, or Risk reports.",
        "Each is available as PDF, XLSX, or CSV.",
      ] },
    ],
  },
  integrations: {
    title: "Integrations",
    intro: "Connect scanners, ITSM, and GRC platforms. Connectors support a mock mode for trial without credentials.",
    sections: [
      { heading: "Actions", items: [
        "Connect Tenable/Qualys and Sync to pull findings into the vulnerability pipeline.",
        "Push a POA&M to ServiceNow, or export POA&Ms in eMASS CSV layout.",
        "Secrets are never displayed back after saving.",
      ] },
    ],
  },
  notifications: {
    title: "Notifications",
    intro: "Continuous-monitoring alerts: overdue POA&Ms/RMF steps, open critical findings/risks, and missing evidence.",
    sections: [
      { heading: "Actions", items: [
        "Run checks recomputes alerts; resolved conditions disappear automatically.",
        "Mark items read; the bell badge tracks unread count.",
      ] },
    ],
  },
  users: {
    title: "User Management",
    intro: "Admin-only: manage accounts, roles, and access for your organization.",
    sections: [
      { heading: "Actions", items: [
        "Invite users (a temporary password is generated), change roles, and activate/deactivate accounts.",
        "Reset a user's password or MFA when needed.",
      ] },
    ],
  },
  audit: {
    title: "Audit Log",
    intro: "Admin-only, append-only record of platform activity for accountability and assessment.",
    sections: [
      { heading: "What you see", items: [
        "Who did what, when, with structured details — paginated, never edited or deleted.",
      ] },
    ],
  },
  account: {
    title: "Account Settings",
    intro: "Manage your own password and multi-factor authentication.",
    sections: [
      { heading: "Actions", items: [
        "Change your password (10+ chars, with a letter and a number).",
        "Enable TOTP MFA with an authenticator app, or disable it with your password.",
      ] },
    ],
  },
};
