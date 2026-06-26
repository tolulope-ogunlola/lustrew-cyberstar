import { describe, it, expect } from "vitest";
import { toOscalControlId, stableUuid, buildOscalSsp, buildOscalAssessmentResults } from "./oscal-export";

describe("toOscalControlId", () => {
  it("lowercases and dots enhancements", () => {
    expect(toOscalControlId("AC-2")).toBe("ac-2");
    expect(toOscalControlId("AC-2(1)")).toBe("ac-2.1");
    expect(toOscalControlId("SI-4 (4)")).toBe("si-4.4");
  });
});

describe("stableUuid", () => {
  it("is deterministic and uuid-shaped", () => {
    const a = stableUuid("ssp:sys1");
    const b = stableUuid("ssp:sys1");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(stableUuid("ssp:sys2")).not.toBe(a);
  });
});

describe("buildOscalSsp", () => {
  const ssp = buildOscalSsp(
    {
      systemId: "sys1",
      systemName: "Atlas",
      description: "Test system",
      fipsCategory: "HIGH",
      controls: [
        { controlId: "AC-2", status: "IMPLEMENTED", scoping: "APPLICABLE", narrative: "We do X.", providerName: "" },
        { controlId: "SC-7", status: "INHERITED", scoping: "INHERITED", narrative: "", providerName: "AWS GovCloud" },
        { controlId: "PE-3", status: "NOT_IMPLEMENTED", scoping: "NOT_APPLICABLE", narrative: "", providerName: "" },
      ],
    },
    "2026-01-01T00:00:00.000Z",
  );
  const plan = ssp["system-security-plan"] as any;

  it("emits a well-formed SSP envelope", () => {
    expect(plan.uuid).toBeTruthy();
    expect(plan.metadata["oscal-version"]).toBe("1.1.2");
    expect(plan["system-characteristics"]["security-sensitivity-level"]).toBe("fips-199-high");
  });

  it("excludes NOT_APPLICABLE controls and maps ids", () => {
    const reqs = plan["control-implementation"]["implemented-requirements"];
    expect(reqs).toHaveLength(2);
    expect(reqs.map((r: any) => r["control-id"])).toEqual(["ac-2", "sc-7"]);
  });

  it("records control-origination for inherited controls", () => {
    const reqs = plan["control-implementation"]["implemented-requirements"];
    const sc7 = reqs.find((r: any) => r["control-id"] === "sc-7");
    const origination = sc7.props.find((p: any) => p.name === "control-origination");
    expect(origination.value).toBe("inherited");
    expect(origination.class).toBe("AWS GovCloud");
  });
});

describe("buildOscalAssessmentResults", () => {
  const ar = buildOscalAssessmentResults(
    {
      assessmentId: "a1",
      title: "Annual SCA",
      systemName: "Atlas",
      assessorName: "J. Assessor",
      startedAt: "2026-01-01T00:00:00.000Z",
      completedAt: "2026-02-01T00:00:00.000Z",
      results: [
        { controlId: "AC-2", result: "SATISFIED", findings: "", recommendation: "" },
        { controlId: "SC-7", result: "OTHER_THAN_SATISFIED", findings: "Boundary gap", recommendation: "Add WAF" },
      ],
    },
    "2026-02-02T00:00:00.000Z",
  );
  const results = (ar["assessment-results"] as any).results[0];

  it("creates findings only for other-than-satisfied controls", () => {
    expect(results.findings).toHaveLength(1);
    expect(results.findings[0].description).toContain("Boundary gap");
    expect(results.findings[0].remarks).toBe("Add WAF");
  });

  it("includes all assessed controls in reviewed-controls", () => {
    const included = results["reviewed-controls"]["control-selections"][0]["include-controls"];
    expect(included.map((c: any) => c["control-id"])).toEqual(["ac-2", "sc-7"]);
  });
});
