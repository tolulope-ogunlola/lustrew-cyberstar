import { prisma } from "@/lib/db";
import { HttpError, requireUser, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { checkAssignSchema } from "@/lib/validation";

// GET: this system's check assignments. POST: assign a check to the system.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requireUser();
    const { id } = await params;
    const system = await prisma.system.findFirst({ where: { id, orgId: user.orgId }, select: { id: true } });
    if (!system) throw new HttpError(404, "System not found");
    return prisma.checkAssignment.findMany({
      where: { systemId: id },
      include: { check: true, results: { orderBy: { checkedAt: "desc" }, take: 1 } },
    });
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "check");
    const { id } = await params;
    const body = checkAssignSchema.parse({ ...(await req.json()), systemId: id });

    const system = await prisma.system.findFirst({ where: { id, orgId: user.orgId }, select: { id: true } });
    if (!system) throw new HttpError(404, "System not found");
    const check = await prisma.check.findUnique({ where: { id: body.checkId }, select: { id: true, providerType: true } });
    if (!check) throw new HttpError(404, "Check not found");

    if (body.integrationId) {
      const integ = await prisma.integration.findFirst({ where: { id: body.integrationId, orgId: user.orgId }, select: { type: true } });
      if (!integ) throw new HttpError(404, "Integration not found");
      if (integ.type !== check.providerType) throw new HttpError(400, `Integration type ${integ.type} does not match check provider ${check.providerType}`);
    }

    const existing = await prisma.checkAssignment.findUnique({ where: { systemId_checkId: { systemId: id, checkId: body.checkId } }, select: { id: true } });
    if (existing) throw new HttpError(409, "Check already assigned to this system");

    const assignment = await prisma.checkAssignment.create({
      data: {
        orgId: user.orgId,
        systemId: id,
        checkId: body.checkId,
        integrationId: body.integrationId || null,
        enabled: body.enabled ?? true,
        paramsJson: JSON.stringify(body.params ?? {}),
      },
    });
    await writeAuditEvent({ actorId: user.id, action: "check.assign", entityType: "check", entityId: assignment.id, metadata: { systemId: id, checkId: body.checkId } });
    return assignment;
  });
}
