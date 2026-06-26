import { describe, it, expect } from "vitest";
import { computeSprs, weightFor, SPRS_MAX, SPRS_FLOOR } from "./sprs";

describe("weightFor", () => {
  it("assigns 5/3/1 by the methodology tiers", () => {
    expect(weightFor("3.1.1")).toBe(5);
    expect(weightFor("3.1.3")).toBe(3);
    expect(weightFor("3.2.1")).toBe(1); // not in 5 or 3 lists
  });
});

describe("computeSprs", () => {
  it("scores 110 when every requirement is met", () => {
    const r = computeSprs([
      { controlId: "3.1.1", met: true },
      { controlId: "3.2.1", met: true },
    ]);
    expect(r.score).toBe(SPRS_MAX);
    expect(r.met).toBe(2);
    expect(r.implementedPercent).toBe(100);
  });

  it("subtracts the correct weight per unmet requirement", () => {
    const r = computeSprs([
      { controlId: "3.1.1", met: false }, // -5
      { controlId: "3.1.3", met: false }, // -3
      { controlId: "3.2.1", met: false }, // -1
      { controlId: "3.5.3", met: true },
    ]);
    expect(r.score).toBe(110 - 9);
    expect(r.notMet[0].weight).toBe(5); // sorted highest-impact first
    expect(r.implementedPercent).toBe(25);
  });

  it("floors at -203", () => {
    const allFive = ["3.1.1", "3.1.2", "3.1.12", "3.1.13", "3.1.16"].map((c) => ({ controlId: c, met: false }));
    // also pile on a big synthetic deduction to force below the floor
    const many = Array.from({ length: 60 }, (_, i) => ({ controlId: `3.1.1`, met: false }));
    const r = computeSprs([...allFive, ...many]);
    expect(r.score).toBe(SPRS_FLOOR);
  });
});
