import { prisma } from "@/lib/db";
import { HttpError, requirePermission, requireUser, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { assessmentCreateSchema } from "@/lib/validation";
import { deriveResultFromStatus } from "@/lib/assessment";

// GET /api/assessments?systemId=X — list assessments for a system (newest first).
export async function GET(req: Request) {
  return route(async () => {
    const user = await requireUser();
    const systemId = new URL(req.url).searchParams.get("systemId");
    if (!systemId) throw new HttpError(400, "systemId is required");
    const system = await prisma.system.findFirst({ where: { id: systemId, orgId: user.orgId }, select: { id: true } });
    if (!system) throw new HttpError(404, "System not found");

    return prisma.assessment.findMany({
      where: { systemId },
      orderBy: { startedAt: "desc" },
      include: { _count: { select: { results: true } } },
    });
  });
}

// POST /api/assessments — start a new SCA; seeds a result row per applicable control,
// prefilled from the current implementation state for the assessor to validate.
export async function POST(req: Request) {
  return route(async () => {
    const user = await requirePermission("write", "assessment");
    const body = assessmentCreateSchema.parse(await req.json());

    const system = await prisma.system.findFirst({ where: { id: body.systemId, orgId: user.orgId }, select: { id: true } });
    if (!system) throw new HttpError(404, "System not found");

    const impls = await prisma.controlImplementation.findMany({
      where: { systemId: body.systemId, scoping: { not: "NOT_APPLICABLE" } },
      include: { control: { select: { controlId: true, title: true } } },
      orderBy: { control: { controlId: "asc" } },
    });

    const assessment = await prisma.assessment.create({
      data: {
        systemId: body.systemId,
        title: body.title,
        assessorName: body.assessorName ?? user.name,
        status: "IN_PROGRESS",
        results: {
          create: impls.map((i) => ({
            controlId: i.control.controlId,
            controlTitle: i.control.title,
            result: deriveResultFromStatus(i.status, i.scoping),
          })),
        },
      },
      include: { _count: { select: { results: true } } },
    });

    await writeAuditEvent({
      actorId: user.id,
      action: "assessment.create",
      entityType: "assessment",
      entityId: assessment.id,
      metadata: { systemId: body.systemId, controls: impls.length },
    });

    return assessment;
  });
}
