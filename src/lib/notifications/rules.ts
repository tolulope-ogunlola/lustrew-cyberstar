import { score as riskScore } from "@/lib/risk";

export type NotifSeverity = "INFO" | "WARNING" | "CRITICAL";

export type NotifDraft = {
  dedupeKey: string;
  category: string;
  severity: NotifSeverity;
  title: string;
  body: string;
  systemId: string;
  systemName: string;
  entityType?: string;
  entityId?: string;
};

export type RuleInput = {
  systemId: string;
  systemName: string;
  now: Date;
  poams: { id: string; poamNumber: string; weaknessTitle: string; severity: string; status: string; scheduledCompletion: Date | null }[];
  rmfSteps: { id: string; step: string; status: string; dueDate: Date | null }[];
  vulns: { id: string; title: string; severity: string; state: string }[];
  risks: { id: string; riskNumber: string; title: string; status: string; likelihood: string; impact: string; targetDate: Date | null }[];
  missingEvidenceCount: number;
};

const OPEN_POAM = new Set(["OPEN", "IN_PROGRESS", "PENDING_REVIEW"]);
const OPEN_RISK = new Set(["OPEN", "MITIGATING"]);

function poamSeverity(s: string): NotifSeverity {
  return s === "CRITICAL" || s === "HIGH" ? "CRITICAL" : "WARNING";
}

const DAY = 86_400_000;

export function buildNotifications(input: RuleInput): NotifDraft[] {
  const { systemId, systemName, now } = input;
  const out: NotifDraft[] = [];
  const base = { systemId, systemName };

  // Overdue POA&Ms
  for (const p of input.poams) {
    if (OPEN_POAM.has(p.status) && p.scheduledCompletion && p.scheduledCompletion < now) {
      const daysOver = Math.floor((now.getTime() - p.scheduledCompletion.getTime()) / DAY);
      out.push({
        ...base,
        dedupeKey: `poam-overdue:${p.id}`,
        category: "POAM_OVERDUE",
        severity: poamSeverity(p.severity),
        title: `POA&M ${p.poamNumber} is overdue`,
        body: `"${p.weaknessTitle}" was due ${daysOver} day(s) ago.`,
        entityType: "poam",
        entityId: p.id,
      });
    }
  }

  // Overdue RMF steps
  for (const s of input.rmfSteps) {
    if (s.status !== "COMPLETE" && s.dueDate && s.dueDate < now) {
      out.push({
        ...base,
        dedupeKey: `rmf-overdue:${s.id}`,
        category: "RMF_OVERDUE",
        severity: "WARNING",
        title: `RMF step ${s.step} is overdue`,
        body: `The ${s.step} step is past its due date and not complete.`,
        entityType: "rmfStep",
        entityId: s.id,
      });
    }
  }

  // Open critical/high vulnerabilities
  for (const v of input.vulns) {
    if (v.state === "OPEN" && (v.severity === "CRITICAL" || v.severity === "HIGH")) {
      out.push({
        ...base,
        dedupeKey: `vuln-open:${v.id}`,
        category: "VULN_OPEN",
        severity: v.severity === "CRITICAL" ? "CRITICAL" : "WARNING",
        title: `${v.severity} vulnerability open`,
        body: v.title,
        entityType: "vulnerability",
        entityId: v.id,
      });
    }
  }

  // Open high/critical risks, and accepted risks whose review date is near/past
  for (const r of input.risks) {
    const rating = riskScore(r.likelihood, r.impact).rating;
    if (OPEN_RISK.has(r.status) && (rating === "HIGH" || rating === "CRITICAL")) {
      out.push({
        ...base,
        dedupeKey: `risk-open:${r.id}`,
        category: "RISK_OPEN",
        severity: rating === "CRITICAL" ? "CRITICAL" : "WARNING",
        title: `${rating} risk open: ${r.riskNumber}`,
        body: r.title,
        entityType: "risk",
        entityId: r.id,
      });
    }
    if (r.status === "ACCEPTED" && r.targetDate && r.targetDate.getTime() - now.getTime() < 30 * DAY) {
      const expired = r.targetDate < now;
      out.push({
        ...base,
        dedupeKey: `risk-accept-exp:${r.id}`,
        category: "RISK_ACCEPT_EXPIRING",
        severity: expired ? "WARNING" : "INFO",
        title: `Risk acceptance ${expired ? "expired" : "expiring"}: ${r.riskNumber}`,
        body: `Accepted risk review date is ${r.targetDate.toISOString().slice(0, 10)}.`,
        entityType: "risk",
        entityId: r.id,
      });
    }
  }

  // Missing evidence (aggregate per system)
  if (input.missingEvidenceCount > 0) {
    out.push({
      ...base,
      dedupeKey: `evidence-missing:${systemId}`,
      category: "EVIDENCE_MISSING",
      severity: "WARNING",
      title: `${input.missingEvidenceCount} control(s) missing evidence`,
      body: "Implemented or partially implemented controls have no linked evidence.",
      entityType: "system",
      entityId: systemId,
    });
  }

  return out;
}
