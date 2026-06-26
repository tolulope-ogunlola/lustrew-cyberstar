import { prisma } from "@/lib/db";
import { HttpError, requireUser, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { systemCreateSchema } from "@/lib/validation";
import { serializeFrameworks, withFrameworks } from "@/lib/util";
import { requirementsForLevel } from "@/lib/cmmc";
import { canAddSystem, getPlan } from "@/lib/plans";

export async function GET() {
  return route(async () => {
    const user = await requireUser();
    const systems = await prisma.system.findMany({
      where: { orgId: user.orgId },
      orderBy: { createdAt: "asc" },
      include: {
        owner: { select: { name: true } },
        _count: { select: { implementations: true, poams: true, evidence: true } },
      },
    });
    return systems.map(withFrameworks);
  });
}

export async function POST(req: Request) {
  return route(async () => {
    const user = await requirePermission("write", "system");
    const body = systemCreateSchema.parse(await req.json());

    // Enforce the org's plan system limit.
    const org = await prisma.organization.findUnique({ where: { id: user.orgId }, select: { plan: true, _count: { select: { systems: true } } } });
    if (org && !canAddSystem(org.plan, org._count.systems)) {
      throw new HttpError(402, `Your ${getPlan(org.plan).label} plan allows up to ${getPlan(org.plan).maxSystems} system(s). Upgrade your plan to add more.`);
    }

    const system = await prisma.system.create({
      data: {
        name: body.name,
        description: body.description ?? "",
        fipsCategory: body.fipsCategory,
        frameworks: serializeFrameworks(body.frameworks),
        orgId: user.orgId,
        ownerId: body.ownerId || null,
      },
    });

    // Spin up an implementation row per applicable catalog control (scoped to the system's
    // frameworks), plus the seven RMF steps. A system can carry 800-53 and/or 800-171 controls.
    const fw = body.frameworks;
    const wants171 = fw.some((f) => f === "CMMC_L1" || f === "CMMC_L2" || f === "NIST_800_171");
    const wants53 = fw.some((f) => !["CMMC_L1", "CMMC_L2", "NIST_800_171"].includes(f)) || !wants171;
    const l1Only = wants171 && fw.includes("CMMC_L1") && !fw.includes("CMMC_L2") && !fw.includes("NIST_800_171");

    const controlIds: string[] = [];
    if (wants53) {
      const c53 = await prisma.control.findMany({ where: { framework: "NIST_800_53" }, select: { id: true } });
      controlIds.push(...c53.map((c) => c.id));
    }
    if (wants171) {
      const c171 = await prisma.control.findMany({ where: { framework: "NIST_800_171" }, orderBy: { controlId: "asc" }, select: { id: true, controlId: true } });
      const keep = l1Only ? new Set(requirementsForLevel("CMMC_L1", c171.map((c) => c.controlId))) : null;
      controlIds.push(...c171.filter((c) => (keep ? keep.has(c.controlId) : true)).map((c) => c.id));
    }
    if (controlIds.length) {
      await prisma.controlImplementation.createMany({
        data: controlIds.map((id) => ({ systemId: system.id, controlId: id })),
      });
    }
    const steps = [
      "PREPARE",
      "CATEGORIZE",
      "SELECT",
      "IMPLEMENT",
      "ASSESS",
      "AUTHORIZE",
      "MONITOR",
    ] as const;
    await prisma.rmfStep.createMany({
      data: steps.map((s) => ({ systemId: system.id, step: s })),
    });

    await writeAuditEvent({
      actorId: user.id,
      action: "system.create",
      entityType: "system",
      entityId: system.id,
      metadata: { name: system.name, controls: controlIds.length },
    });

    return withFrameworks(system);
  });
}
