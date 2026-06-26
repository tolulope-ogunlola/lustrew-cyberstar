import { describe, expect, it } from "vitest";
import { can, ROLE_NAV } from "./rbac";

describe("rbac.can", () => {
  it("lets ADMIN write everything including audit", () => {
    expect(can("ADMIN", "write", "system")).toBe(true);
    expect(can("ADMIN", "write", "audit")).toBe(true);
  });

  it("lets ATO_SME write systems but not audit", () => {
    expect(can("ATO_SME", "write", "system")).toBe(true);
    expect(can("ATO_SME", "write", "audit")).toBe(false);
  });

  it("restricts EXECUTIVE to read-only", () => {
    expect(can("EXECUTIVE", "write", "poam")).toBe(false);
    expect(can("EXECUTIVE", "read", "system")).toBe(true);
    expect(can("EXECUTIVE", "write", "system")).toBe(false);
  });

  it("limits SYSTEM_OWNER writes to evidence", () => {
    expect(can("SYSTEM_OWNER", "write", "evidence")).toBe(true);
    expect(can("SYSTEM_OWNER", "write", "control")).toBe(false);
  });

  it("VULN_ANALYST can write POA&Ms but not controls", () => {
    expect(can("VULN_ANALYST", "write", "poam")).toBe(true);
    expect(can("VULN_ANALYST", "write", "control")).toBe(false);
  });
});

describe("ROLE_NAV", () => {
  it("only exposes the audit nav item to ADMIN", () => {
    expect(ROLE_NAV.ADMIN).toContain("audit");
    for (const role of ["ATO_SME", "ISSO", "VULN_ANALYST", "SYSTEM_OWNER", "EXECUTIVE"] as const) {
      expect(ROLE_NAV[role]).not.toContain("audit");
    }
  });

  it("limits EXECUTIVE to read-only dashboard, risk register, and reports", () => {
    expect(ROLE_NAV.EXECUTIVE).toEqual(["dashboard", "risks", "policies", "reports", "notifications"]);
    expect(can("EXECUTIVE", "read", "risk")).toBe(true);
    expect(can("EXECUTIVE", "write", "risk")).toBe(false);
  });
});
