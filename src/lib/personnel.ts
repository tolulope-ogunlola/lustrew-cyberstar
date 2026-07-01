// Personnel compliance helpers — pure rollup logic, unit-tested in personnel.test.ts.

export type PersonComplianceStatus = "COMPLIANT" | "AT_RISK" | "NON_COMPLIANT";

const OPEN_TRAINING = new Set(["ASSIGNED", "IN_PROGRESS", "OVERDUE"]);
const OPEN_ACCESS_REVIEW = new Set(["PENDING", "IN_PROGRESS", "OVERDUE"]);

export type PersonRollupInput = {
  status: string; // personnel status
  mfaEnabled: boolean | null; // null = no linked app user
  bgCheckStatus: string;
  trainings: { status: string; dueDate: Date | null }[];
  accessReviews: { status: string; dueDate: Date | null }[];
  onboardingTasks: { done: boolean; dueDate: Date | null }[];
  requiredPoliciesAcked: boolean;
};

/**
 * Roll a person's signals into a single compliance status.
 *  - NON_COMPLIANT: any hard failure (overdue training/review/task, failed bg check, MFA off for an app user).
 *  - AT_RISK: incomplete-but-not-yet-overdue items, or background check not cleared.
 *  - COMPLIANT: everything settled.
 */
export function personComplianceStatus(p: PersonRollupInput, now: Date = new Date()): PersonComplianceStatus {
  const overdue = (d: Date | null) => !!d && d < now;

  const trainingOverdue = p.trainings.some(
    (t) => OPEN_TRAINING.has(t.status) && (t.status === "OVERDUE" || overdue(t.dueDate))
  );
  const reviewOverdue = p.accessReviews.some(
    (r) => OPEN_ACCESS_REVIEW.has(r.status) && (r.status === "OVERDUE" || overdue(r.dueDate))
  );
  const taskOverdue = p.onboardingTasks.some((t) => !t.done && overdue(t.dueDate));
  const bgFailed = p.bgCheckStatus === "FAILED";
  const mfaOff = p.mfaEnabled === false; // explicit: a linked user without MFA

  if (trainingOverdue || reviewOverdue || taskOverdue || bgFailed || mfaOff) return "NON_COMPLIANT";

  const trainingPending = p.trainings.some((t) => OPEN_TRAINING.has(t.status));
  const reviewPending = p.accessReviews.some((r) => OPEN_ACCESS_REVIEW.has(r.status));
  const taskPending = p.onboardingTasks.some((t) => !t.done);
  const bgNotCleared = !["CLEARED", "EXEMPT"].includes(p.bgCheckStatus);

  if (trainingPending || reviewPending || taskPending || bgNotCleared || !p.requiredPoliciesAcked) {
    return "AT_RISK";
  }
  return "COMPLIANT";
}

export function nextTrainingDue(completedAt: Date, cadenceDays: number): Date | null {
  if (cadenceDays <= 0) return null;
  return new Date(completedAt.getTime() + cadenceDays * 86_400_000);
}
