import { describe, it, expect } from "vitest";
import { getPlan, canAddSystem, PLANS } from "./plans";

describe("getPlan", () => {
  it("returns the named plan and falls back to FREE for unknown/empty", () => {
    expect(getPlan("MSP").id).toBe("MSP");
    expect(getPlan(null).id).toBe("FREE");
    expect(getPlan("nonsense").id).toBe("FREE");
  });
});

describe("canAddSystem", () => {
  it("enforces per-plan system limits", () => {
    expect(canAddSystem("FREE", 0)).toBe(true);
    expect(canAddSystem("FREE", 1)).toBe(false); // FREE = 1 system
    expect(canAddSystem("PRO", 9)).toBe(true);
    expect(canAddSystem("PRO", 10)).toBe(false);
  });

  it("treats ENTERPRISE as unlimited", () => {
    expect(PLANS.ENTERPRISE.maxSystems).toBe(Infinity);
    expect(canAddSystem("ENTERPRISE", 9999)).toBe(true);
  });
});
