import type { Role } from "./types";
import type { IconName } from "@/components/icons";

// Navigation items in the authenticated shell. Used both for routing and the sidebar.
export type NavKey =
  | "dashboard"
  | "systems"
  | "controls"
  | "crosswalks"
  | "evidence"
  | "vulnerabilities"
  | "stig"
  | "poams"
  | "risks"
  | "ppsm"
  | "policies"
  | "reports"
  | "integrations"
  | "notifications"
  | "users"
  | "audit";

export type NavSection = "COMPLIANCE" | "SYSTEM";

export const NAV_SECTIONS: NavSection[] = ["COMPLIANCE", "SYSTEM"];

export const NAV_META: Record<
  NavKey,
  { label: string; subtitle: string; href: string; icon: IconName; section: NavSection }
> = {
  dashboard: { label: "Overview", subtitle: "Posture & readiness", href: "/dashboard", icon: "gauge", section: "COMPLIANCE" },
  systems: { label: "Systems", subtitle: "Authorization boundaries", href: "/systems", icon: "server", section: "COMPLIANCE" },
  controls: { label: "Controls", subtitle: "NIST 800-53 library", href: "/controls", icon: "shield", section: "COMPLIANCE" },
  crosswalks: { label: "Crosswalks", subtitle: "CMMC / ISO / SOC 2 mapping", href: "/crosswalks", icon: "scale", section: "COMPLIANCE" },
  evidence: { label: "Evidence", subtitle: "Artifacts & mapping", href: "/evidence", icon: "folder", section: "COMPLIANCE" },
  vulnerabilities: { label: "Vulnerabilities", subtitle: "Scan findings & triage", href: "/vulnerabilities", icon: "alert", section: "COMPLIANCE" },
  stig: { label: "STIG", subtitle: "Checklist compliance", href: "/stig", icon: "check", section: "COMPLIANCE" },
  poams: { label: "POA&Ms", subtitle: "Findings & remediation", href: "/poams", icon: "flag", section: "COMPLIANCE" },
  risks: { label: "Risk Register", subtitle: "Likelihood × impact", href: "/risks", icon: "scale", section: "COMPLIANCE" },
  ppsm: { label: "PPSM", subtitle: "Ports, protocols, services", href: "/ppsm", icon: "plug", section: "COMPLIANCE" },
  policies: { label: "Policies", subtitle: "Governance & acknowledgements", href: "/policies", icon: "book", section: "COMPLIANCE" },
  reports: { label: "Reports", subtitle: "Export PDF / XLSX / CSV", href: "/reports", icon: "doc", section: "SYSTEM" },
  integrations: { label: "Integrations", subtitle: "Connected platforms", href: "/integrations", icon: "plug", section: "SYSTEM" },
  notifications: { label: "Notifications", subtitle: "Alerts & reminders", href: "/notifications", icon: "bell", section: "SYSTEM" },
  users: { label: "Users", subtitle: "Accounts & roles", href: "/admin/users", icon: "users", section: "SYSTEM" },
  audit: { label: "Audit Log", subtitle: "Activity & changes", href: "/audit", icon: "list", section: "SYSTEM" },
};

// Which nav items each role sees. Executives get a read-only posture view; system owners
// work on their assigned systems; admins see everything including the audit log.
export const ROLE_NAV: Record<Role, NavKey[]> = {
  ADMIN: ["dashboard", "systems", "controls", "crosswalks", "evidence", "vulnerabilities", "stig", "poams", "risks", "ppsm", "policies", "reports", "integrations", "notifications", "users", "audit"],
  ATO_SME: ["dashboard", "systems", "controls", "crosswalks", "evidence", "vulnerabilities", "stig", "poams", "risks", "ppsm", "policies", "reports", "integrations", "notifications"],
  ISSO: ["dashboard", "systems", "controls", "crosswalks", "evidence", "vulnerabilities", "stig", "poams", "risks", "ppsm", "policies", "reports", "integrations", "notifications"],
  VULN_ANALYST: ["dashboard", "systems", "vulnerabilities", "stig", "poams", "reports", "notifications"],
  SYSTEM_OWNER: ["dashboard", "systems", "evidence", "ppsm", "policies", "notifications"],
  EXECUTIVE: ["dashboard", "risks", "policies", "reports", "notifications"],
};

// Coarse-grained permissions. `action` is "read" or "write"; `entity` is the resource family.
export type Action = "read" | "write";
export type Entity =
  | "system"
  | "control"
  | "evidence"
  | "rmf"
  | "poam"
  | "vuln"
  | "risk"
  | "stig"
  | "ppsm"
  | "policy"
  | "integration"
  | "audit"
  | "ai";

const WRITE_MATRIX: Record<Role, Entity[]> = {
  ADMIN: ["system", "control", "evidence", "rmf", "poam", "vuln", "risk", "stig", "ppsm", "policy", "integration", "audit", "ai"],
  ATO_SME: ["system", "control", "evidence", "rmf", "poam", "vuln", "risk", "stig", "ppsm", "policy", "integration", "ai"],
  ISSO: ["control", "evidence", "rmf", "poam", "vuln", "risk", "stig", "ppsm", "policy", "integration", "ai"],
  VULN_ANALYST: ["poam", "vuln", "stig", "ai"],
  SYSTEM_OWNER: ["evidence", "ppsm"],
  EXECUTIVE: [],
};

const READ_MATRIX: Record<Role, Entity[] | "all"> = {
  ADMIN: "all",
  ATO_SME: "all",
  ISSO: "all",
  VULN_ANALYST: ["system", "control", "poam", "vuln", "stig", "ai"],
  SYSTEM_OWNER: ["system", "control", "evidence", "rmf", "poam", "ppsm", "policy"],
  EXECUTIVE: ["system", "control", "poam", "rmf", "vuln", "risk", "policy"],
};

export function can(role: Role, action: Action, entity: Entity): boolean {
  if (action === "write") return WRITE_MATRIX[role].includes(entity);
  const read = READ_MATRIX[role];
  return read === "all" || read.includes(entity);
}

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrator",
  ATO_SME: "ATO/A&A SME",
  ISSO: "ISSO / Compliance Analyst",
  VULN_ANALYST: "Vulnerability Analyst",
  SYSTEM_OWNER: "System Owner",
  EXECUTIVE: "Executive / PM",
};
