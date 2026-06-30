import { describe, it, expect } from "vitest";
import { personComplianceStatus, nextTrainingDue, type PersonRollupInput } from "./personnel";

const now = new Date("2026-06-30T00:00:00Z");
const DAY = 86_400_000;

const base: PersonRollupInput = {
  status: "ACTIVE",
  mfaEnabled: true,
  bgCheckStatus: "CLEARED",
  trainings: [],
  accessReviews: [],
  onboardingTasks: [],
  requiredPoliciesAcked: true,
};

describe("personComplianceStatus", () => {
  it("is COMPLIANT when everything is settled", () => {
    expect(personComplianceStatus(base, now)).toBe("COMPLIANT");
  });

  it("is NON_COMPLIANT on overdue training", () => {
    expect(personComplianceStatus({ ...base, trainings: [{ status: "ASSIGNED", dueDate: new Date(now.getTime() - DAY) }] }, now)).toBe("NON_COMPLIANT");
    expect(personComplianceStatus({ ...base, trainings: [{ status: "OVERDUE", dueDate: null }] }, now)).toBe("NON_COMPLIANT");
  });

  it("is NON_COMPLIANT when a linked user has MFA off or bg check failed", () => {
    expect(personComplianceStatus({ ...base, mfaEnabled: false }, now)).toBe("NON_COMPLIANT");
    expect(personComplianceStatus({ ...base, bgCheckStatus: "FAILED" }, now)).toBe("NON_COMPLIANT");
  });

  it("is AT_RISK on not-yet-overdue pending work", () => {
    expect(personComplianceStatus({ ...base, trainings: [{ status: "ASSIGNED", dueDate: new Date(now.getTime() + 5 * DAY) }] }, now)).toBe("AT_RISK");
    expect(personComplianceStatus({ ...base, bgCheckStatus: "PENDING" }, now)).toBe("AT_RISK");
    expect(personComplianceStatus({ ...base, requiredPoliciesAcked: false }, now)).toBe("AT_RISK");
  });

  it("ignores MFA for contractors with no app user", () => {
    expect(personComplianceStatus({ ...base, mfaEnabled: null }, now)).toBe("COMPLIANT");
  });
});

describe("nextTrainingDue", () => {
  it("adds cadence to completion date", () => {
    const c = new Date("2026-01-01T00:00:00Z");
    expect(nextTrainingDue(c, 365)?.toISOString().slice(0, 10)).toBe("2027-01-01");
    expect(nextTrainingDue(c, 0)).toBeNull();
  });
});
