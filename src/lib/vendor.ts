// Vendor / third-party risk helpers. Reuses the RiskRating vocabulary from lib/risk.ts.
import type { RiskRating } from "@/lib/risk";

export type VendorRiskRating = RiskRating; // LOW | MEDIUM | HIGH | CRITICAL

const SENSITIVITY_WEIGHT: Record<string, number> = {
  NONE: 0,
  PUBLIC: 1,
  INTERNAL: 2,
  CONFIDENTIAL: 3,
  PII: 4,
  PHI: 5,
  CUI: 5,
};
const CRITICALITY_WEIGHT: Record<string, number> = {
  LOW: 1,
  MODERATE: 2,
  HIGH: 3,
  CRITICAL: 4,
};

/** Heuristic inherent rating from data sensitivity × business criticality. */
export function vendorRiskRating(dataSensitivity: string, criticality: string): VendorRiskRating {
  const s = SENSITIVITY_WEIGHT[dataSensitivity] ?? 0;
  const c = CRITICALITY_WEIGHT[criticality] ?? 2;
  const product = s * c; // 0..20
  if (product >= 15) return "CRITICAL";
  if (product >= 9) return "HIGH";
  if (product >= 4) return "MEDIUM";
  return "LOW";
}

const CADENCE_DAYS: Record<string, number> = {
  NONE: 0,
  QUARTERLY: 90,
  SEMIANNUAL: 182,
  ANNUAL: 365,
  BIENNIAL: 730,
};

export function computeNextReviewDate(from: Date, cadence: string): Date | null {
  const days = CADENCE_DAYS[cadence] ?? 0;
  if (days <= 0) return null;
  return new Date(from.getTime() + days * 86_400_000);
}

export const OPEN_REVIEW_STATUSES = new Set([
  "NOT_STARTED",
  "QUESTIONNAIRE_SENT",
  "QUESTIONNAIRE_RECEIVED",
  "IN_REVIEW",
  "OVERDUE",
]);

export function isReviewOverdue(nextReviewDate: Date | null, now: Date = new Date()): boolean {
  return !!nextReviewDate && nextReviewDate < now;
}

export function formatVendorNumber(n: number): string {
  return `VEND-${String(n).padStart(4, "0")}`;
}
