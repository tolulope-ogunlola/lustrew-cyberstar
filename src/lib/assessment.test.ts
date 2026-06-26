import { describe, it, expect } from "vitest";
import { deriveResultFromStatus, summarizeResults, canComplete } from "./assessment";

describe("deriveResultFromStatus", () => {
  it("maps not-applicable scoping to NOT_APPLICABLE regardless of status", () => {
    expect(deriveResultFromStatus("IMPLEMENTED", "NOT_APPLICABLE")).toBe("NOT_APPLICABLE");
  });
  it("maps IMPLEMENTED to SATISFIED", () => {
    expect(deriveResultFromStatus("IMPLEMENTED", "APPLICABLE")).toBe("SATISFIED");
  });
  it("maps partial/risk-accepted/not-implemented to OTHER_THAN_SATISFIED", () => {
    expect(deriveResultFromStatus("PARTIALLY_IMPLEMENTED", "APPLICABLE")).toBe("OTHER_THAN_SATISFIED");
    expect(deriveResultFromStatus("RISK_ACCEPTED", "APPLICABLE")).toBe("OTHER_THAN_SATISFIED");
    expect(deriveResultFromStatus("NOT_IMPLEMENTED", "APPLICABLE")).toBe("OTHER_THAN_SATISFIED");
  });
});

describe("summarizeResults", () => {
  it("counts buckets and computes assessed percent over applicable controls", () => {
    const s = summarizeResults([
      { result: "SATISFIED" },
      { result: "OTHER_THAN_SATISFIED" },
      { result: "NOT_APPLICABLE" },
      { result: "NOT_ASSESSED" },
    ]);
    expect(s.total).toBe(4);
    expect(s.satisfied).toBe(1);
    expect(s.otherThanSatisfied).toBe(1);
    expect(s.notApplicable).toBe(1);
    expect(s.notAssessed).toBe(1);
    // applicable = 3 (excludes NA); assessed = 2 of 3 = 67%
    expect(s.assessedPercent).toBe(67);
  });

  it("reports 0% when there are no applicable controls", () => {
    expect(summarizeResults([{ result: "NOT_APPLICABLE" }]).assessedPercent).toBe(0);
  });
});

describe("canComplete", () => {
  it("is false while any control is NOT_ASSESSED, true once all are assessed", () => {
    expect(canComplete([{ result: "SATISFIED" }, { result: "NOT_ASSESSED" }])).toBe(false);
    expect(canComplete([{ result: "SATISFIED" }, { result: "NOT_APPLICABLE" }])).toBe(true);
    expect(canComplete([])).toBe(false);
  });
});
