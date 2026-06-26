import { describe, it, expect } from "vitest";
import { CROSSWALKS } from "./crosswalks";

describe("framework crosswalks", () => {
  it("has unique 800-53 family codes", () => {
    const codes = CROSSWALKS.map((r) => r.family);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("provides a mapping for every framework column on each row", () => {
    for (const r of CROSSWALKS) {
      expect(r.familyName.length).toBeGreaterThan(0);
      expect(r.cmmc.length).toBeGreaterThan(0);
      expect(r.iso27001.length).toBeGreaterThan(0);
      expect(r.soc2.length).toBeGreaterThan(0);
    }
  });

  it("covers the core 800-53 families used by the catalog", () => {
    const codes = new Set(CROSSWALKS.map((r) => r.family));
    for (const fam of ["AC", "AU", "CM", "IA", "IR", "RA", "SC", "SI"]) {
      expect(codes.has(fam)).toBe(true);
    }
  });
});
