import { describe, expect, it } from "vitest";
import { buildEmassCsv } from "./emass";
import { SCANNERS, mapTenableExportRow } from "./scanners";
import { REPOSITORIES, mapGraphItems } from "./sharepoint";
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

  it("maps a Tenable vulns-export row to a ParsedVuln with host/port/cve/cvss", () => {
    const v = mapTenableExportRow({
      severity_id: 4,
      plugin: { id: 19506, name: "Apache RCE", cve: ["CVE-2023-1234"], cvss3_base_score: 9.8, solution: "Upgrade" },
      asset: { hostname: "web01", ipv4: "10.0.2.10" },
      port: { port: 443 },
    });
    expect(v.pluginId).toBe("19506");
    expect(v.cve).toBe("CVE-2023-1234");
    expect(v.severity).toBe("Critical");
    expect(v.cvss).toBe(9.8);
    expect(v.host).toBe("web01");
    expect(v.port).toBe("443");
  });
});

describe("SharePoint repository connector", () => {
  it("mock returns sample documents and tests ok", async () => {
    expect((await REPOSITORIES.SHAREPOINT.testConnection({ mock: true })).ok).toBe(true);
    const docs = await REPOSITORIES.SHAREPOINT.fetchDocuments({ mock: true });
    expect(docs.length).toBeGreaterThan(0);
    expect(docs[0].url).toMatch(/^https:\/\//);
  });

  it("maps Graph driveItems to docs and skips folders", () => {
    const docs = mapGraphItems([
      { name: "Policy.pdf", webUrl: "https://x/Policy.pdf", size: 100, file: { mimeType: "application/pdf" } },
      { name: "A folder", webUrl: "https://x/folder", folder: { childCount: 2 } },
    ]);
    expect(docs).toHaveLength(1);
    expect(docs[0].name).toBe("Policy.pdf");
    expect(docs[0].contentType).toBe("application/pdf");
  });

  it("test fails without credentials in live mode", async () => {
    expect((await REPOSITORIES.SHAREPOINT.testConnection({ mock: false })).ok).toBe(false);
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
