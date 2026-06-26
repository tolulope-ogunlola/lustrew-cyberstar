import { describe, expect, it } from "vitest";
import { computeScore, type ImplForScore } from "./scoring";

function impl(status: string, scoping = "APPLICABLE", evidence = 0): ImplForScore {
  return { status, scoping, narrative: "", _evidenceCount: evidence };
}

describe("computeScore", () => {
  it("returns zeros for an empty system", () => {
    const s = computeScore([], [], []);
    expect(s.posturePercent).toBe(0);
    expect(s.readinessScore).toBe(0);
    expect(s.controlsTotal).toBe(0);
  });

  it("weights implemented fully and partial at half", () => {
    const s = computeScore(
      [impl("IMPLEMENTED"), impl("PARTIALLY_IMPLEMENTED"), impl("NOT_IMPLEMENTED")],
      [],
      []
    );
    // (1 + 0.5 + 0) / 3 = 0.5
    expect(s.posturePercent).toBe(50);
    expect(s.controlsApplicable).toBe(3);
  });

  it("excludes NOT_APPLICABLE controls from posture", () => {
    const s = computeScore(
      [impl("IMPLEMENTED"), impl("NOT_IMPLEMENTED", "NOT_APPLICABLE")],
      [],
      []
    );
    expect(s.controlsApplicable).toBe(1);
    expect(s.posturePercent).toBe(100);
  });

  it("counts evidence completeness only for implemented/partial controls", () => {
    const s = computeScore(
      [impl("IMPLEMENTED", "APPLICABLE", 1), impl("IMPLEMENTED", "APPLICABLE", 0)],
      [],
      []
    );
    expect(s.evidenceCompletePercent).toBe(50);
  });

  it("flags overdue POA&Ms and penalizes readiness", () => {
    const past = new Date(Date.now() - 86400000);
    const future = new Date(Date.now() + 86400000);
    const s = computeScore(
      [impl("IMPLEMENTED")],
      [{ status: "COMPLETE" }],
      [
        { status: "OPEN", scheduledCompletion: past, actualCompletion: null },
        { status: "OPEN", scheduledCompletion: future, actualCompletion: null },
        { status: "CLOSED", scheduledCompletion: past, actualCompletion: past },
      ]
    );
    expect(s.openPoams).toBe(2); // two OPEN, CLOSED excluded
    expect(s.overduePoams).toBe(1); // only the past-due open one
  });

  it("aggregates byStatus counts", () => {
    const s = computeScore(
      [impl("IMPLEMENTED"), impl("IMPLEMENTED"), impl("PLANNED")],
      [],
      []
    );
    expect(s.byStatus.IMPLEMENTED).toBe(2);
    expect(s.byStatus.PLANNED).toBe(1);
  });
});
