import { describe, it, expect } from "vitest";
import { CHECK_CONNECTORS, getCheckConnector } from "./checks";

describe("CCM connectors (mock mode)", () => {
  it("registers all five provider types", () => {
    for (const t of ["GITHUB", "M365", "GOOGLE_WS", "AWS", "OCI"]) {
      expect(getCheckConnector(t)).toBeDefined();
    }
    expect(getCheckConnector("NOPE")).toBeUndefined();
  });

  it("every probe returns a well-formed ProbeResult in mock mode", async () => {
    for (const [type, connector] of Object.entries(CHECK_CONNECTORS)) {
      for (const [name, probe] of Object.entries(connector.probes)) {
        const r = await probe({ mock: true }, { maxAdmins: 5 });
        expect(["PASS", "FAIL", "ERROR"], `${type}.${name} status`).toContain(r.status);
        expect(typeof r.details, `${type}.${name} details`).toBe("string");
        expect(r.evidence, `${type}.${name} evidence`).toBeTypeOf("object");
      }
    }
  });

  it("testConnection succeeds in mock mode", async () => {
    for (const connector of Object.values(CHECK_CONNECTORS)) {
      const r = await connector.testConnection({ mock: true });
      expect(r.ok).toBe(true);
    }
  });

  it("GitHub mock probes produce a mix of pass and fail", async () => {
    const gh = getCheckConnector("GITHUB")!;
    const mfa = await gh.probes.listUsersMfaStatus({ mock: true });
    const branch = await gh.probes.listRepoBranchProtection({ mock: true });
    expect(mfa.status).toBe("PASS");
    expect(branch.status).toBe("FAIL");
  });
});
