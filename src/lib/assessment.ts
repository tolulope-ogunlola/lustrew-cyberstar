// Security Control Assessment (SCA) helpers. Pure functions — unit tested in assessment.test.ts.

export type AssessmentResultValue = "SATISFIED" | "OTHER_THAN_SATISFIED" | "NOT_APPLICABLE" | "NOT_ASSESSED";

// Prefill an assessor's starting position from the current implementation state, so a new
// assessment isn't a blank slate. Assessors review and override as they validate evidence.
export function deriveResultFromStatus(status: string, scoping: string): AssessmentResultValue {
  if (scoping === "NOT_APPLICABLE") return "NOT_APPLICABLE";
  if (status === "IMPLEMENTED") return "SATISFIED";
  if (status === "RISK_ACCEPTED" || status === "PARTIALLY_IMPLEMENTED") return "OTHER_THAN_SATISFIED";
  // PLANNED / NOT_IMPLEMENTED — not yet in place; leave for the assessor to confirm.
  return "OTHER_THAN_SATISFIED";
}

export type ResultSummary = {
  total: number;
  satisfied: number;
  otherThanSatisfied: number;
  notApplicable: number;
  notAssessed: number;
  assessedPercent: number; // share of applicable controls with a non-NOT_ASSESSED result
};

export function summarizeResults(results: { result: string }[]): ResultSummary {
  const total = results.length;
  const satisfied = results.filter((r) => r.result === "SATISFIED").length;
  const otherThanSatisfied = results.filter((r) => r.result === "OTHER_THAN_SATISFIED").length;
  const notApplicable = results.filter((r) => r.result === "NOT_APPLICABLE").length;
  const notAssessed = results.filter((r) => r.result === "NOT_ASSESSED").length;
  const applicable = total - notApplicable;
  const assessedPercent = applicable === 0 ? 0 : Math.round(((applicable - notAssessed) / applicable) * 100);
  return { total, satisfied, otherThanSatisfied, notApplicable, notAssessed, assessedPercent };
}

// An assessment can only be completed once every applicable control has been assessed.
export function canComplete(results: { result: string }[]): boolean {
  return results.length > 0 && results.every((r) => r.result !== "NOT_ASSESSED");
}
