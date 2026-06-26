import { prisma } from "@/lib/db";
import { requireUser, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { systemCreateSchema } from "@/lib/validation";
import { serializeFrameworks, withFrameworks } from "@/lib/util";

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

    // Spin up an implementation row per catalog control, plus the seven RMF steps.
    const controls = await prisma.control.findMany({ select: { id: true } });
    if (controls.length) {
      await prisma.controlImplementation.createMany({
        data: controls.map((c) => ({ systemId: system.id, controlId: c.id })),
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
      metadata: { name: system.name, controls: controls.length },
    });

    return withFrameworks(system);
  });
}
