import { prisma } from "@/lib/db";

export const EVIDENCE_STATUS = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUS)[number];

// Transitions an author (write evidence) may perform: prepare and submit, or re-open a stale/
// rejected artifact to re-collect it.
export const AUTHOR_TRANSITIONS: Record<string, EvidenceStatus[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["DRAFT"],
  REJECTED: ["DRAFT", "SUBMITTED"],
  EXPIRED: ["DRAFT", "SUBMITTED"],
};

// Transitions reserved for an approver (write evidenceApproval) — separation of duties so an
// uploader cannot approve their own evidence.
export const APPROVER_TRANSITIONS: Record<string, EvidenceStatus[]> = {
  SUBMITTED: ["UNDER_REVIEW", "APPROVED", "REJECTED"],
  UNDER_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["UNDER_REVIEW"],
};

export function canTransition(from: string, to: string, asApprover: boolean): boolean {
  const author = AUTHOR_TRANSITIONS[from] ?? [];
  if (author.includes(to as EvidenceStatus)) return true;
  if (asApprover) return (APPROVER_TRANSITIONS[from] ?? []).includes(to as EvidenceStatus);
  return false;
}

export type FreshnessInput = {
  approvalStatus: string;
  validUntil: Date | null;
  cadenceDays: number;
  collectedAt: Date | null;
};

/** True when approved evidence has passed its expiry or recollection cadence. */
export function isStale(ev: FreshnessInput, now: Date = new Date()): boolean {
  if (ev.approvalStatus === "EXPIRED") return true;
  if (ev.approvalStatus !== "APPROVED") return false;
  if (ev.validUntil && ev.validUntil < now) return true;
  if (ev.cadenceDays > 0 && ev.collectedAt) {
    const expiresAt = new Date(ev.collectedAt.getTime() + ev.cadenceDays * 86_400_000);
    if (expiresAt < now) return true;
  }
  return false;
}

/** Derive an explicit expiry from a collection date + cadence (null when no cadence). */
export function computeValidUntil(collectedAt: Date | null, cadenceDays: number): Date | null {
  if (!collectedAt || cadenceDays <= 0) return null;
  return new Date(collectedAt.getTime() + cadenceDays * 86_400_000);
}

export function freshnessSummary(
  rows: FreshnessInput[],
  now: Date = new Date()
): { total: number; approved: number; fresh: number; freshPercent: number } {
  const total = rows.length;
  const approved = rows.filter((r) => r.approvalStatus === "APPROVED").length;
  const fresh = rows.filter((r) => r.approvalStatus === "APPROVED" && !isStale(r, now)).length;
  const freshPercent = total === 0 ? 100 : Math.round((fresh / total) * 100);
  return { total, approved, fresh, freshPercent };
}

/**
 * Flip APPROVED evidence that has passed its expiry/cadence to EXPIRED, appending a system-
 * generated history row. Idempotent — safe to run from the notifications cron.
 */
export async function expireStaleEvidence(orgId: string, now: Date = new Date()): Promise<number> {
  const approved = await prisma.evidence.findMany({
    where: { system: { orgId }, approvalStatus: "APPROVED" },
    select: { id: true, approvalStatus: true, validUntil: true, cadenceDays: true, collectedAt: true },
  });
  const stale = approved.filter((e) => isStale(e, now));
  for (const e of stale) {
    await prisma.evidence.update({
      where: { id: e.id },
      data: {
        approvalStatus: "EXPIRED",
        statusHistory: { create: { status: "EXPIRED", note: "Auto-expired: past validity/cadence.", changedBy: null } },
      },
    });
  }
  return stale.length;
}
