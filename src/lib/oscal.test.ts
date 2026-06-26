import { describe, expect, it } from "vitest";
import { parseOscalCatalog } from "./oscal";
import sample from "../../scripts/data/oscal-sample.json";

describe("parseOscalCatalog", () => {
  it("flattens groups, controls, and enhancements with labels and family", () => {
    const rows = parseOscalCatalog(sample);
    const ids = rows.map((r) => r.controlId);
    expect(ids).toContain("AC-1");
    expect(ids).toContain("AC-1(1)"); // enhancement
    expect(ids).toContain("AU-2");

    const ac1 = rows.find((r) => r.controlId === "AC-1")!;
    expect(ac1.family).toBe("AC");
    expect(ac1.title).toBe("Policy and Procedures");
    expect(ac1.text).toContain("access control policy");
  });

  it("rejects non-OSCAL documents", () => {
    expect(() => parseOscalCatalog({ foo: 1 })).toThrow();
  });

  it("derives family from control id when group family is absent", () => {
    const rows = parseOscalCatalog({
      catalog: { controls: [{ id: "sc-7", props: [{ name: "label", value: "SC-7" }], title: "Boundary Protection" }] },
    });
    expect(rows[0].family).toBe("SC");
  });
});
