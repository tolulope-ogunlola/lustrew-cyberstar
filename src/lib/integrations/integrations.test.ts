import { describe, expect, it } from "vitest";
import { buildEmassCsv } from "./emass";
import { SCANNERS } from "./scanners";
import { pushPoamToServiceNow } from "./servicenow";
import { CONNECTORS } from "./registry";

describe("eMASS export", () => {
  it("emits a header and a row per POA&M with eMASS columns", () => {
    const csv = buildEmassCsv("Atlas", [
      {
        poamNumber: "POAM-0001",
        weaknessTitle: "Weak ciphers",
        weaknessDescription: "TLS 1.0 enabled",
        severity: "HIGH",
        riskRating: "HIGH",
        status: "OPEN",
        source: "Vulnerability",
        remediationPlan: "Disable TLS 1.0",
        residualRisk: "",
        scheduledCompletion: new Date("2026-08-01T00:00:00Z"),
        control: "SC-8",
      },
    ]).toString("utf8");
    expect(csv).toContain("Control Vulnerability Description");
    expect(csv).toContain("POAM-0001");
    expect(csv).toContain("SC-8");
    expect(csv).toContain("2026-08-01");
  });
});

describe("scanner connectors (mock)", () => {
  it("Tenable mock returns sample findings and tests ok", async () => {
    expect((await SCANNERS.TENABLE.testConnection({ mock: true })).ok).toBe(true);
    const findings = await SCANNERS.TENABLE.fetchFindings({ mock: true });
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].title).toBeTruthy();
  });

  it("Qualys mock returns sample findings", async () => {
    const findings = await SCANNERS.QUALYS.fetchFindings({ mock: true });
    expect(findings.length).toBeGreaterThan(0);
  });

  it("scanner test fails without credentials in live mode", async () => {
    expect((await SCANNERS.TENABLE.testConnection({ mock: false })).ok).toBe(false);
  });
});

describe("ServiceNow push (mock)", () => {
  it("returns a synthetic incident number", async () => {
    const r = await pushPoamToServiceNow(
      { mock: true },
      { poamNumber: "POAM-0001", weaknessTitle: "x", weaknessDescription: "y", severity: "HIGH" }
    );
    expect(r.ok).toBe(true);
    expect(r.ref).toMatch(/^INC\d+$/);
  });
});

describe("registry", () => {
  it("lists all connectors with capabilities", () => {
    expect(CONNECTORS.map((c) => c.type).sort()).toEqual(["EMASS", "QUALYS", "SERVICENOW", "SHAREPOINT", "TENABLE"]);
  });
});
