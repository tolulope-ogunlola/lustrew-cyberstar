import { describe, expect, it } from "vitest";
import { buildNotifications, type RuleInput } from "./rules";

const now = new Date("2026-06-24T00:00:00Z");
const past = new Date("2026-06-10T00:00:00Z");
const future = new Date("2026-12-01T00:00:00Z");

function input(partial: Partial<RuleInput>): RuleInput {
  return {
    systemId: "sys1",
    systemName: "Atlas",
    now,
    poams: [],
    rmfSteps: [],
    vulns: [],
    risks: [],
    missingEvidenceCount: 0,
    ...partial,
  };
}

describe("buildNotifications", () => {
  it("flags an overdue open POA&M and escalates by severity", () => {
    const out = buildNotifications(
      input({
        poams: [
          { id: "p1", poamNumber: "POAM-0001", weaknessTitle: "x", severity: "HIGH", status: "OPEN", scheduledCompletion: past },
          { id: "p2", poamNumber: "POAM-0002", weaknessTitle: "y", severity: "LOW", status: "OPEN", scheduledCompletion: future },
          { id: "p3", poamNumber: "POAM-0003", weaknessTitle: "z", severity: "HIGH", status: "CLOSED", scheduledCompletion: past },
        ],
      })
    );
    expect(out).toHaveLength(1);
    expect(out[0].category).toBe("POAM_OVERDUE");
    expect(out[0].severity).toBe("CRITICAL");
    expect(out[0].dedupeKey).toBe("poam-overdue:p1");
  });

  it("flags overdue RMF steps that aren't complete", () => {
    const out = buildNotifications(
      input({
        rmfSteps: [
          { id: "s1", step: "ASSESS", status: "IN_PROGRESS", dueDate: past },
          { id: "s2", step: "PREPARE", status: "COMPLETE", dueDate: past },
        ],
      })
    );
    expect(out.map((o) => o.category)).toEqual(["RMF_OVERDUE"]);
  });

  it("flags open critical/high vulns only", () => {
    const out = buildNotifications(
      input({
        vulns: [
          { id: "v1", title: "RCE", severity: "CRITICAL", state: "OPEN" },
          { id: "v2", title: "med", severity: "MEDIUM", state: "OPEN" },
          { id: "v3", title: "fixed", severity: "CRITICAL", state: "REMEDIATED" },
        ],
      })
    );
    expect(out).toHaveLength(1);
    expect(out[0].severity).toBe("CRITICAL");
  });

  it("flags high/critical open risks and expiring acceptances", () => {
    const out = buildNotifications(
      input({
        risks: [
          { id: "r1", riskNumber: "RISK-1", title: "big", status: "OPEN", likelihood: "VERY_HIGH", impact: "VERY_HIGH", targetDate: null },
          { id: "r2", riskNumber: "RISK-2", title: "small", status: "OPEN", likelihood: "LOW", impact: "LOW", targetDate: null },
          { id: "r3", riskNumber: "RISK-3", title: "acc", status: "ACCEPTED", likelihood: "LOW", impact: "LOW", targetDate: past },
        ],
      })
    );
    const cats = out.map((o) => o.category).sort();
    expect(cats).toEqual(["RISK_ACCEPT_EXPIRING", "RISK_OPEN"]);
  });

  it("emits a single aggregate evidence-missing notification", () => {
    const out = buildNotifications(input({ missingEvidenceCount: 7 }));
    expect(out).toHaveLength(1);
    expect(out[0].category).toBe("EVIDENCE_MISSING");
    expect(out[0].title).toContain("7");
    expect(out[0].dedupeKey).toBe("evidence-missing:sys1");
  });

  it("produces nothing for a clean system", () => {
    expect(buildNotifications(input({}))).toHaveLength(0);
  });
});
