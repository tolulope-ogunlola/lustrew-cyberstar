import { describe, it, expect } from "vitest";
import { computeGaps } from "./gaps";
import type { SystemDossier } from "./dossier";

function dossier(overrides: Partial<SystemDossier> = {}): SystemDossier {
  return {
    system: { id: "s1", name: "Test", description: "", fipsCategory: "MODERATE", frameworks: [] },
    score: {
      posturePercent: 50,
      readinessScore: 40,
      controlsTotal: 0,
      controlsApplicable: 0,
      byStatus: { IMPLEMENTED: 0, PARTIALLY_IMPLEMENTED: 0, PLANNED: 0, NOT_IMPLEMENTED: 0, RISK_ACCEPTED: 0 },
      evidenceCompletePercent: 0,
      rmfProgressPercent: 0,
      openPoams: 0,
      overduePoams: 0,
    },
    controls: [],
    rmf: [],
    poams: [],
    vulns: [],
    risks: [],
    policies: [],
    ...overrides,
  };
}

const ctrl = (o: Partial<SystemDossier["controls"][number]>): SystemDossier["controls"][number] => ({
  controlId: "AC-2",
  family: "AC",
  title: "Account Management",
  text: "",
  status: "IMPLEMENTED",
  scoping: "APPLICABLE",
  narrative: "documented",
  evidenceCount: 1,
  ...o,
});

describe("computeGaps", () => {
  it("returns no gaps for a clean system", () => {
    expect(computeGaps(dossier())).toEqual([]);
  });

  it("flags unimplemented applicable controls as HIGH", () => {
    const gaps = computeGaps(dossier({ controls: [ctrl({ status: "NOT_IMPLEMENTED" })] }));
    const g = gaps.find((x) => x.id === "controls-unimplemented");
    expect(g?.severity).toBe("HIGH");
    expect(g?.count).toBe(1);
  });

  it("ignores controls scoped out (not applicable / inherited)", () => {
    const gaps = computeGaps(dossier({ controls: [ctrl({ status: "NOT_IMPLEMENTED", scoping: "NOT_APPLICABLE" })] }));
    expect(gaps).toEqual([]);
  });

  it("flags implemented controls missing evidence and narrative", () => {
    const gaps = computeGaps(dossier({ controls: [ctrl({ evidenceCount: 0, narrative: "" })] }));
    expect(gaps.map((g) => g.id)).toEqual(expect.arrayContaining(["evidence-missing", "narrative-missing"]));
  });

  it("flags overdue POA&Ms and open critical vulns, sorted HIGH-first", () => {
    const gaps = computeGaps(
      dossier({
        poams: [{ poamNumber: "POAM-1", title: "x", severity: "HIGH", status: "OPEN", scheduled: "2020-01-01", overdue: true }],
        vulns: [{ title: "RCE", severity: "CRITICAL", cve: "CVE-1" }],
        rmf: [{ step: "ASSESS", status: "IN_PROGRESS" }],
      }),
    );
    expect(gaps[0].severity).toBe("HIGH");
    expect(gaps.map((g) => g.id)).toEqual(expect.arrayContaining(["poams-overdue", "vulns-open", "rmf-incomplete"]));
    // LOW severity (rmf) must sort after HIGH
    expect(gaps[gaps.length - 1].id).toBe("rmf-incomplete");
  });
});
