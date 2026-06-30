import { describe, it, expect } from "vitest";
import { CROSSWALKS, familyOf, equivalentControls } from "./crosswalks";

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

describe("familyOf", () => {
  it("derives the family from a control id", () => {
    expect(familyOf("AC-2")).toBe("AC");
    expect(familyOf("SC-7(4)")).toBe("SC");
  });
  it("returns the input when there is no family prefix", () => {
    expect(familyOf("CC6.1")).toBe("CC6.1");
  });
});

describe("equivalentControls", () => {
  it("maps a NIST 800-53 control to ISO/SOC2/CMMC references", () => {
    const refs = equivalentControls("NIST_800_53", "AC-2");
    const frameworks = refs.map((r) => r.framework);
    expect(frameworks).toContain("ISO_27001");
    expect(frameworks).toContain("SOC2");
  });
  it("returns nothing for commercial-catalog control ids (no reverse mapping asserted)", () => {
    expect(equivalentControls("SOC2", "CC6.1")).toEqual([]);
    expect(equivalentControls("ISO_27001", "A.8.5")).toEqual([]);
  });
});
