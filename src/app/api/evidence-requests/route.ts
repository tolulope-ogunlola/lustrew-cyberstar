import { prisma } from "@/lib/db";
import { HttpError, requirePermission, requireUser, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { evidenceRequestCreateSchema } from "@/lib/validation";

// GET /api/evidence-requests?systemId=X — list assessor evidence requests for a system.
export async function GET(req: Request) {
  return route(async () => {
    const user = await requireUser();
    const systemId = new URL(req.url).searchParams.get("systemId");
    if (!systemId) throw new HttpError(400, "systemId is required");
    const system = await prisma.system.findFirst({ where: { id: systemId, orgId: user.orgId }, select: { id: true } });
    if (!system) throw new HttpError(404, "System not found");
    return prisma.evidenceRequest.findMany({
      where: { systemId },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: { requestedBy: { select: { name: true } } },
    });
  });
}

// POST /api/evidence-requests — an assessor (or ISSO/SME) flags a control needing more evidence.
export async function POST(req: Request) {
  return route(async () => {
    const user = await requirePermission("write", "evidenceRequest");
    const body = evidenceRequestCreateSchema.parse(await req.json());
    const system = await prisma.system.findFirst({ where: { id: body.systemId, orgId: user.orgId }, select: { id: true } });
    if (!system) throw new HttpError(404, "System not found");

    const request = await prisma.evidenceRequest.create({
      data: { systemId: body.systemId, controlId: body.controlId, note: body.note ?? "", requestedById: user.id },
      include: { requestedBy: { select: { name: true } } },
    });
    await writeAuditEvent({
      actorId: user.id,
      action: "evidence_request.create",
      entityType: "evidenceRequest",
      entityId: request.id,
      metadata: { systemId: body.systemId, control: body.controlId },
    });
    return request;
  });
}
