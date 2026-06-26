import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";

// Proves the org-scoping query patterns used throughout the API actually isolate tenants.
// Runs against the throwaway integration DB provisioned in setup.ts.

const prisma = new PrismaClient();

type Tenant = { orgId: string; userId: string; systemId: string; poamId: string; riskId: string };

async function makeTenant(name: string): Promise<Tenant> {
  const org = await prisma.organization.create({ data: { name } });
  const user = await prisma.user.create({
    data: { email: `${name}@t.test`, name, role: "ISSO", passwordHash: "x", orgId: org.id },
  });
  const system = await prisma.system.create({
    data: { name: `${name}-sys`, frameworks: "[]", orgId: org.id },
  });
  const poam = await prisma.poam.create({
    data: { poamNumber: `${name}-1`, weaknessTitle: "w", systemId: system.id },
  });
  const risk = await prisma.risk.create({
    data: { riskNumber: `${name}-R1`, title: "r", systemId: system.id },
  });
  return { orgId: org.id, userId: user.id, systemId: system.id, poamId: poam.id, riskId: risk.id };
}

let a: Tenant;
let b: Tenant;

beforeAll(async () => {
  // Clean in FK-safe order.
  await prisma.poam.deleteMany();
  await prisma.risk.deleteMany();
  await prisma.system.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();
  a = await makeTenant("orgA");
  b = await makeTenant("orgB");
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("tenant isolation", () => {
  it("system lookup is org-scoped (cannot read another org's system)", async () => {
    const crossOrg = await prisma.system.findFirst({ where: { id: b.systemId, orgId: a.orgId } });
    expect(crossOrg).toBeNull();
    const sameOrg = await prisma.system.findFirst({ where: { id: b.systemId, orgId: b.orgId } });
    expect(sameOrg).not.toBeNull();
  });

  it("system list only returns the caller's org", async () => {
    const list = await prisma.system.findMany({ where: { orgId: a.orgId } });
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(a.systemId);
  });

  it("POA&M access is scoped through the system's org", async () => {
    const cross = await prisma.poam.findFirst({ where: { id: b.poamId, system: { orgId: a.orgId } } });
    expect(cross).toBeNull();
    const same = await prisma.poam.findFirst({ where: { id: b.poamId, system: { orgId: b.orgId } } });
    expect(same).not.toBeNull();
  });

  it("risk access is scoped through the system's org", async () => {
    const cross = await prisma.risk.findFirst({ where: { id: b.riskId, system: { orgId: a.orgId } } });
    expect(cross).toBeNull();
  });

  it("users are isolated per org", async () => {
    const aUsers = await prisma.user.findMany({ where: { orgId: a.orgId } });
    expect(aUsers.every((u) => u.orgId === a.orgId)).toBe(true);
    expect(aUsers.some((u) => u.id === b.userId)).toBe(false);
  });

  it("deleting an org cascades its systems but never touches the other org", async () => {
    const temp = await makeTenant("orgC");
    await prisma.organization.delete({ where: { id: temp.orgId } });
    expect(await prisma.system.findUnique({ where: { id: temp.systemId } })).toBeNull();
    // Org A is untouched.
    expect(await prisma.system.findUnique({ where: { id: a.systemId } })).not.toBeNull();
  });
});
