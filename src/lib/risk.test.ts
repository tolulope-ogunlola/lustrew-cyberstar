import { describe, expect, it } from "vitest";
import { assessRisk, isOpenRisk, ratingFromScore, score } from "./risk";

describe("risk scoring", () => {
  it("multiplies likelihood × impact on a 1..5 scale", () => {
    expect(score("VERY_HIGH", "VERY_HIGH").score).toBe(25);
    expect(score("MODERATE", "MODERATE").score).toBe(9);
    expect(score("VERY_LOW", "VERY_LOW").score).toBe(1);
  });

  it("bands scores into qualitative ratings", () => {
    expect(ratingFromScore(25)).toBe("CRITICAL");
    expect(ratingFromScore(20)).toBe("CRITICAL");
    expect(ratingFromScore(16)).toBe("HIGH");
    expect(ratingFromScore(9)).toBe("MEDIUM");
    expect(ratingFromScore(4)).toBe("LOW");
  });

  it("defaults unknown levels to MODERATE (3)", () => {
    expect(score("nonsense", "nonsense").score).toBe(9);
  });

  it("computes inherent and residual separately", () => {
    const a = assessRisk({
      likelihood: "VERY_HIGH",
      impact: "VERY_HIGH",
      residualLikelihood: "LOW",
      residualImpact: "MODERATE",
    });
    expect(a.inherent.rating).toBe("CRITICAL");
    expect(a.residual.score).toBe(6);
    expect(a.residual.rating).toBe("MEDIUM");
  });

  it("treats OPEN and MITIGATING as open", () => {
    expect(isOpenRisk("OPEN")).toBe(true);
    expect(isOpenRisk("MITIGATING")).toBe(true);
    expect(isOpenRisk("ACCEPTED")).toBe(false);
    expect(isOpenRisk("CLOSED")).toBe(false);
  });
});
