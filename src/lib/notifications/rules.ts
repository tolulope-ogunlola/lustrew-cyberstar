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
  // Freshness/approval signals. `stale` is precomputed by the caller (run.ts) so this module stays pure.
  evidence?: { id: string; title: string; approvalStatus: string; validUntil: Date | null; stale: boolean }[];
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

  // Evidence freshness + approval backlog (per artifact)
  for (const e of input.evidence ?? []) {
    if (e.stale) {
      out.push({
        ...base,
        dedupeKey: `evidence-expired:${e.id}`,
        category: "EVIDENCE_EXPIRED",
        severity: "WARNING",
        title: `Evidence expired: ${e.title}`,
        body: "Approved evidence has passed its validity/recollection cadence and must be refreshed.",
        entityType: "evidence",
        entityId: e.id,
      });
    } else if (
      e.approvalStatus === "APPROVED" &&
      e.validUntil &&
      e.validUntil.getTime() - now.getTime() < 30 * DAY
    ) {
      out.push({
        ...base,
        dedupeKey: `evidence-expiring:${e.id}`,
        category: "EVIDENCE_EXPIRING",
        severity: "INFO",
        title: `Evidence expiring: ${e.title}`,
        body: `Valid until ${e.validUntil.toISOString().slice(0, 10)}.`,
        entityType: "evidence",
        entityId: e.id,
      });
    }
    if (e.approvalStatus === "SUBMITTED" || e.approvalStatus === "UNDER_REVIEW") {
      out.push({
        ...base,
        dedupeKey: `evidence-review-pending:${e.id}`,
        category: "EVIDENCE_REVIEW_PENDING",
        severity: "INFO",
        title: `Evidence awaiting review: ${e.title}`,
        body: "Submitted evidence is pending approver review.",
        entityType: "evidence",
        entityId: e.id,
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

const ORG_BASE = { systemId: "", systemName: "" };
const within30 = (d: Date | null, now: Date) => !!d && d.getTime() - now.getTime() < 30 * DAY;

export type VendorRuleInput = {
  now: Date;
  vendors: { id: string; vendorNumber: string; name: string; status: string; nextReviewDate: Date | null; hasDpa: boolean; dpaExpiresAt: Date | null }[];
  expiringDocs: { id: string; vendorName: string; title: string; validUntil: Date | null }[];
};

// Org-scoped vendor reminders (vendors aren't tied to a single system).
export function buildVendorNotifications(input: VendorRuleInput): NotifDraft[] {
  const { now } = input;
  const out: NotifDraft[] = [];
  for (const v of input.vendors) {
    if (v.status !== "TERMINATED" && within30(v.nextReviewDate, now)) {
      const overdue = !!v.nextReviewDate && v.nextReviewDate < now;
      out.push({
        ...ORG_BASE,
        dedupeKey: `vendor-review-due:${v.id}`,
        category: "VENDOR_REVIEW_DUE",
        severity: overdue ? "WARNING" : "INFO",
        title: `Vendor review ${overdue ? "overdue" : "due"}: ${v.name}`,
        body: `${v.vendorNumber} review date is ${v.nextReviewDate!.toISOString().slice(0, 10)}.`,
        entityType: "vendor",
        entityId: v.id,
      });
    }
    if (v.hasDpa && within30(v.dpaExpiresAt, now)) {
      const expired = !!v.dpaExpiresAt && v.dpaExpiresAt < now;
      out.push({
        ...ORG_BASE,
        dedupeKey: `vendor-dpa-exp:${v.id}`,
        category: "VENDOR_DPA_EXPIRING",
        severity: expired ? "WARNING" : "INFO",
        title: `DPA ${expired ? "expired" : "expiring"}: ${v.name}`,
        body: `Data processing agreement valid until ${v.dpaExpiresAt!.toISOString().slice(0, 10)}.`,
        entityType: "vendor",
        entityId: v.id,
      });
    }
  }
  for (const d of input.expiringDocs) {
    if (within30(d.validUntil, now)) {
      const expired = !!d.validUntil && d.validUntil < now;
      out.push({
        ...ORG_BASE,
        dedupeKey: `vendor-doc-exp:${d.id}`,
        category: "VENDOR_DOC_EXPIRING",
        severity: expired ? "WARNING" : "INFO",
        title: `Vendor document ${expired ? "expired" : "expiring"}: ${d.vendorName}`,
        body: `${d.title} valid until ${d.validUntil!.toISOString().slice(0, 10)}.`,
        entityType: "vendorDocument",
        entityId: d.id,
      });
    }
  }
  return out;
}

export type CheckRuleInput = {
  failing: { assignmentId: string; systemId: string; systemName: string; checkTitle: string; severity: string; details: string; status: string }[];
};

// CCM check failures/errors → notifications (one per assignment's latest result).
export function buildCheckNotifications(input: CheckRuleInput): NotifDraft[] {
  const out: NotifDraft[] = [];
  for (const f of input.failing) {
    const critical = f.severity === "CRITICAL" || f.severity === "HIGH";
    out.push({
      systemId: f.systemId,
      systemName: f.systemName,
      dedupeKey: `check-failed:${f.assignmentId}`,
      category: "CHECK_FAILED",
      severity: f.status === "ERROR" ? "INFO" : critical ? "CRITICAL" : "WARNING",
      title: `${f.status === "ERROR" ? "Check error" : "Check failing"}: ${f.checkTitle}`,
      body: f.details,
      entityType: "checkAssignment",
      entityId: f.assignmentId,
    });
  }
  return out;
}

export type PersonnelRuleInput = {
  now: Date;
  trainings: { id: string; personName: string; courseName: string; status: string; dueDate: Date | null }[];
  accessReviews: { id: string; personName: string; status: string; dueDate: Date | null }[];
  onboardingTasks: { id: string; personName: string; title: string; done: boolean; dueDate: Date | null }[];
};

const overdueDate = (d: Date | null, now: Date) => !!d && d < now;

// Org-scoped personnel reminders.
export function buildPersonnelNotifications(input: PersonnelRuleInput): NotifDraft[] {
  const { now } = input;
  const out: NotifDraft[] = [];
  for (const t of input.trainings) {
    const open = t.status === "ASSIGNED" || t.status === "IN_PROGRESS" || t.status === "OVERDUE";
    if (open && (t.status === "OVERDUE" || overdueDate(t.dueDate, now))) {
      out.push({
        ...ORG_BASE,
        dedupeKey: `training-overdue:${t.id}`,
        category: "TRAINING_OVERDUE",
        severity: "WARNING",
        title: `Training overdue: ${t.personName}`,
        body: `"${t.courseName}" is past due.`,
        entityType: "trainingAssignment",
        entityId: t.id,
      });
    }
  }
  for (const r of input.accessReviews) {
    const open = r.status === "PENDING" || r.status === "IN_PROGRESS" || r.status === "OVERDUE";
    if (open && (r.status === "OVERDUE" || overdueDate(r.dueDate, now))) {
      out.push({
        ...ORG_BASE,
        dedupeKey: `access-review-overdue:${r.id}`,
        category: "ACCESS_REVIEW_OVERDUE",
        severity: "WARNING",
        title: `Access review overdue: ${r.personName}`,
        body: "A user access review is past its due date.",
        entityType: "accessReview",
        entityId: r.id,
      });
    }
  }
  for (const t of input.onboardingTasks) {
    if (!t.done && overdueDate(t.dueDate, now)) {
      out.push({
        ...ORG_BASE,
        dedupeKey: `onboard-overdue:${t.id}`,
        category: "ONBOARDING_TASK_OVERDUE",
        severity: "INFO",
        title: `Onboarding task overdue: ${t.personName}`,
        body: t.title,
        entityType: "onboardingTask",
        entityId: t.id,
      });
    }
  }
  return out;
}
