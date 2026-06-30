import { describe, it, expect } from "vitest";
import { catalogsForFrameworks, isCatalogKey } from "./frameworks";

describe("catalogsForFrameworks", () => {
  it("maps NIST/FISMA labels to the 800-53 catalog", () => {
    const r = catalogsForFrameworks(["NIST_RMF", "FISMA"]);
    expect(r.wants53).toBe(true);
    expect(r.wants171).toBe(false);
    expect(r.commercial).toEqual([]);
  });

  it("maps a commercial-only system to its catalogs without pulling in 800-53", () => {
    const r = catalogsForFrameworks(["SOC2", "ISO_27001"]);
    expect(r.wants53).toBe(false);
    expect(r.wants171).toBe(false);
    expect(r.commercial).toEqual(["SOC2", "ISO_27001"]);
  });

  it("detects CMMC L1-only scoping", () => {
    const r = catalogsForFrameworks(["CMMC_L1"]);
    expect(r.wants171).toBe(true);
    expect(r.l1Only).toBe(true);
  });

  it("supports mixed federal + commercial systems", () => {
    const r = catalogsForFrameworks(["NIST_800_53", "HIPAA"]);
    expect(r.wants53).toBe(true);
    expect(r.commercial).toEqual(["HIPAA"]);
  });
});

describe("isCatalogKey", () => {
  it("accepts known catalogs and rejects others", () => {
    expect(isCatalogKey("SOC2")).toBe(true);
    expect(isCatalogKey("NIST_800_53")).toBe(true);
    expect(isCatalogKey("NIST_RMF")).toBe(false);
    expect(isCatalogKey("bogus")).toBe(false);
  });
});
