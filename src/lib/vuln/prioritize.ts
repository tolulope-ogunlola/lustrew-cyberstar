// Vulnerability prioritization, NIST control mapping, and remediation SLAs.
// Pure functions — unit tested in prioritize.test.ts.

export type VulnSeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type VulnPriority = "IMMEDIATE" | "HIGH" | "MEDIUM" | "LOW";

const SEVERITY_BASE: Record<VulnSeverity, number> = {
  CRITICAL: 90,
  HIGH: 70,
  MEDIUM: 45,
  LOW: 20,
  INFO: 5,
};

// Days allowed to remediate by severity (typical RMF/FedRAMP-style SLAs).
const SLA_DAYS: Record<VulnSeverity, number> = {
  CRITICAL: 15,
  HIGH: 30,
  MEDIUM: 90,
  LOW: 180,
  INFO: 365,
};

export function normalizeSeverity(raw: string | number | null | undefined): VulnSeverity {
  if (raw == null) return "INFO";
  if (typeof raw === "number" || /^\d+$/.test(String(raw).trim())) {
    // Nessus numeric severity 0..4
    const n = Number(raw);
    return (["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"] as VulnSeverity[])[Math.min(4, Math.max(0, n))];
  }
  const s = String(raw).trim().toLowerCase();
  if (s.startsWith("crit")) return "CRITICAL";
  if (s.startsWith("high")) return "HIGH";
  if (s.startsWith("med") || s === "moderate") return "MEDIUM";
  if (s.startsWith("low")) return "LOW";
  return "INFO";
}

/** Severity inferred from a CVSS base score when the scanner didn't provide a label. */
export function severityFromCvss(cvss: number): VulnSeverity {
  if (cvss >= 9) return "CRITICAL";
  if (cvss >= 7) return "HIGH";
  if (cvss >= 4) return "MEDIUM";
  if (cvss > 0) return "LOW";
  return "INFO";
}

// Keyword → NIST 800-53 control mapping. Falls back to SI-2 (Flaw Remediation), the control
// most vulnerability findings support; RA-5 covers the scanning program itself.
const CONTROL_RULES: { re: RegExp; control: string }[] = [
  // Word-boundary on tls/ssl so product names like "OpenSSL" don't false-match as crypto findings.
  { re: /encrypt|\b(tls|ssl)\b|cipher|certificate|\bhttps\b/i, control: "SC-8" },
  { re: /password|credential|authentication|default account|login|mfa/i, control: "IA-5" },
  { re: /patch|update|outdated|unsupported|end of life|version|missing security/i, control: "SI-2" },
  { re: /malware|virus|trojan|antivirus/i, control: "SI-3" },
  { re: /configuration|hardening|stig|registry|setting/i, control: "CM-6" },
  { re: /audit|logging|log retention/i, control: "AU-2" },
  { re: /port|service|protocol|firewall|open share/i, control: "SC-7" },
];

export function mapControl(title: string, description = ""): string {
  const haystack = `${title} ${description}`;
  for (const rule of CONTROL_RULES) {
    if (rule.re.test(haystack)) return rule.control;
  }
  return "SI-2";
}

export type Assessment = {
  severity: VulnSeverity;
  priority: VulnPriority;
  priorityScore: number;
  recommendation: string;
  mappedControl: string;
};

const RECOMMENDATION: Record<VulnPriority, string> = {
  IMMEDIATE: "Remediate immediately (active/high-risk exposure).",
  HIGH: "Create a POA&M with a near-term remediation milestone.",
  MEDIUM: "Create a POA&M or schedule remediation in the next cycle.",
  LOW: "Review; risk-accept or mark as false positive if validated.",
};

export function assess(input: {
  severity?: string | number | null;
  cvss?: number | null;
  title: string;
  description?: string;
  firstSeen?: Date;
  now?: Date;
}): Assessment {
  const now = input.now ?? new Date();
  let severity = normalizeSeverity(input.severity);
  // If no usable label but we have CVSS, derive severity from it.
  if (severity === "INFO" && input.cvss && input.cvss > 0) {
    severity = severityFromCvss(input.cvss);
  }

  let score = SEVERITY_BASE[severity];
  if (input.cvss != null) score = Math.max(score, Math.round(input.cvss * 10));

  // Age pressure: open findings that have lingered climb in priority.
  if (input.firstSeen) {
    const ageDays = (now.getTime() - input.firstSeen.getTime()) / 86_400_000;
    score += Math.min(10, Math.floor(ageDays / 14) * 2);
  }
  score = Math.min(100, score);

  const priority: VulnPriority =
    score >= 85 ? "IMMEDIATE" : score >= 60 ? "HIGH" : score >= 35 ? "MEDIUM" : "LOW";

  return {
    severity,
    priority,
    priorityScore: score,
    recommendation: RECOMMENDATION[priority],
    mappedControl: mapControl(input.title, input.description),
  };
}

export function slaDueDate(severity: VulnSeverity, from: Date = new Date()): Date {
  return new Date(from.getTime() + SLA_DAYS[severity] * 86_400_000);
}

// Vulnerability severity → POA&M severity (POA&M uses MODERATE rather than MEDIUM).
export function toPoamSeverity(severity: VulnSeverity): string {
  return severity === "MEDIUM" ? "MODERATE" : severity;
}
