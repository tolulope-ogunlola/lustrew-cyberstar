import { describe, it, expect } from "vitest";
import { isStale, computeValidUntil, canTransition, freshnessSummary } from "./evidence";

const DAY = 86_400_000;

describe("isStale", () => {
  const now = new Date("2026-06-30T00:00:00Z");

  it("treats EXPIRED as stale regardless of dates", () => {
    expect(isStale({ approvalStatus: "EXPIRED", validUntil: null, cadenceDays: 0, collectedAt: null }, now)).toBe(true);
  });

  it("is not stale for non-approved evidence", () => {
    expect(isStale({ approvalStatus: "DRAFT", validUntil: new Date(now.getTime() - DAY), cadenceDays: 0, collectedAt: null }, now)).toBe(false);
    expect(isStale({ approvalStatus: "SUBMITTED", validUntil: null, cadenceDays: 30, collectedAt: new Date(now.getTime() - 90 * DAY) }, now)).toBe(false);
  });

  it("is stale when approved evidence is past validUntil", () => {
    expect(isStale({ approvalStatus: "APPROVED", validUntil: new Date(now.getTime() - DAY), cadenceDays: 0, collectedAt: null }, now)).toBe(true);
    expect(isStale({ approvalStatus: "APPROVED", validUntil: new Date(now.getTime() + DAY), cadenceDays: 0, collectedAt: null }, now)).toBe(false);
  });

  it("is stale when approved evidence exceeds its cadence", () => {
    expect(isStale({ approvalStatus: "APPROVED", validUntil: null, cadenceDays: 30, collectedAt: new Date(now.getTime() - 31 * DAY) }, now)).toBe(true);
    expect(isStale({ approvalStatus: "APPROVED", validUntil: null, cadenceDays: 30, collectedAt: new Date(now.getTime() - 10 * DAY) }, now)).toBe(false);
  });
});

describe("computeValidUntil", () => {
  it("returns null with no cadence", () => {
    expect(computeValidUntil(new Date(), 0)).toBeNull();
    expect(computeValidUntil(null, 365)).toBeNull();
  });
  it("adds the cadence in days", () => {
    const base = new Date("2026-01-01T00:00:00Z");
    expect(computeValidUntil(base, 365)?.toISOString().slice(0, 10)).toBe("2027-01-01");
  });
});

describe("canTransition", () => {
  it("lets an author submit but not approve", () => {
    expect(canTransition("DRAFT", "SUBMITTED", false)).toBe(true);
    expect(canTransition("SUBMITTED", "APPROVED", false)).toBe(false);
  });
  it("lets an approver review and approve", () => {
    expect(canTransition("SUBMITTED", "UNDER_REVIEW", true)).toBe(true);
    expect(canTransition("UNDER_REVIEW", "APPROVED", true)).toBe(true);
    expect(canTransition("SUBMITTED", "REJECTED", true)).toBe(true);
  });
  it("allows re-collection from terminal states", () => {
    expect(canTransition("REJECTED", "DRAFT", false)).toBe(true);
    expect(canTransition("EXPIRED", "SUBMITTED", false)).toBe(true);
  });
  it("rejects nonsense transitions", () => {
    expect(canTransition("DRAFT", "APPROVED", true)).toBe(false);
    expect(canTransition("APPROVED", "DRAFT", true)).toBe(false);
  });
});

describe("freshnessSummary", () => {
  const now = new Date("2026-06-30T00:00:00Z");
  it("computes the fresh percentage over all evidence", () => {
    const rows = [
      { approvalStatus: "APPROVED", validUntil: new Date(now.getTime() + DAY), cadenceDays: 0, collectedAt: null },
      { approvalStatus: "APPROVED", validUntil: new Date(now.getTime() - DAY), cadenceDays: 0, collectedAt: null },
      { approvalStatus: "DRAFT", validUntil: null, cadenceDays: 0, collectedAt: null },
      { approvalStatus: "EXPIRED", validUntil: null, cadenceDays: 0, collectedAt: null },
    ];
    const s = freshnessSummary(rows, now);
    expect(s.total).toBe(4);
    expect(s.approved).toBe(2);
    expect(s.fresh).toBe(1);
    expect(s.freshPercent).toBe(25);
  });
  it("returns 100% for an empty vault", () => {
    expect(freshnessSummary([], now).freshPercent).toBe(100);
  });
});
