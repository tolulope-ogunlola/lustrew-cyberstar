import { describe, expect, it } from "vitest";
import {
  assess,
  mapControl,
  normalizeSeverity,
  severityFromCvss,
  slaDueDate,
  toPoamSeverity,
} from "./prioritize";

describe("normalizeSeverity", () => {
  it("maps Nessus numeric severity", () => {
    expect(normalizeSeverity(4)).toBe("CRITICAL");
    expect(normalizeSeverity("3")).toBe("HIGH");
    expect(normalizeSeverity(0)).toBe("INFO");
  });
  it("maps text labels including 'moderate'", () => {
    expect(normalizeSeverity("Critical")).toBe("CRITICAL");
    expect(normalizeSeverity("moderate")).toBe("MEDIUM");
    expect(normalizeSeverity("Low")).toBe("LOW");
  });
  it("defaults unknown to INFO", () => {
    expect(normalizeSeverity(null)).toBe("INFO");
    expect(normalizeSeverity("weird")).toBe("INFO");
  });
});

describe("severityFromCvss", () => {
  it("bands CVSS scores", () => {
    expect(severityFromCvss(9.8)).toBe("CRITICAL");
    expect(severityFromCvss(7.5)).toBe("HIGH");
    expect(severityFromCvss(5)).toBe("MEDIUM");
    expect(severityFromCvss(2)).toBe("LOW");
    expect(severityFromCvss(0)).toBe("INFO");
  });
});

describe("mapControl", () => {
  it("maps by keyword and falls back to SI-2", () => {
    expect(mapControl("TLS 1.0 supported")).toBe("SC-8");
    expect(mapControl("Default password detected")).toBe("IA-5");
    expect(mapControl("Outdated OpenSSL version")).toBe("SI-2");
    expect(mapControl("Some unmapped finding")).toBe("SI-2");
  });
});

describe("assess", () => {
  it("derives severity from CVSS when label is INFO", () => {
    const a = assess({ severity: "info", cvss: 9.5, title: "x" });
    expect(a.severity).toBe("CRITICAL");
    expect(a.priority).toBe("IMMEDIATE");
  });
  it("rates a low finding as LOW priority", () => {
    const a = assess({ severity: "low", cvss: 2, title: "x" });
    expect(a.priority).toBe("LOW");
  });
  it("produces a recommendation and mapped control", () => {
    const a = assess({ severity: "high", title: "Missing security patch" });
    expect(a.priority).toBe("HIGH");
    expect(a.mappedControl).toBe("SI-2");
    expect(a.recommendation).toMatch(/POA&M/);
  });
});

describe("slaDueDate / toPoamSeverity", () => {
  it("critical SLA is 15 days out", () => {
    const from = new Date("2026-01-01T00:00:00Z");
    const due = slaDueDate("CRITICAL", from);
    expect(Math.round((due.getTime() - from.getTime()) / 86_400_000)).toBe(15);
  });
  it("maps MEDIUM to MODERATE for POA&Ms", () => {
    expect(toPoamSeverity("MEDIUM")).toBe("MODERATE");
    expect(toPoamSeverity("HIGH")).toBe("HIGH");
  });
});
