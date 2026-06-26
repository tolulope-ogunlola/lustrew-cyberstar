import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { evidenceRequestResolveSchema } from "@/lib/validation";

// PATCH /api/evidence-requests/[id] — resolve (or reopen) an evidence request with a response.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "evidenceRequest");
    const { id } = await params;
    const body = evidenceRequestResolveSchema.parse(await req.json());

    const existing = await prisma.evidenceRequest.findFirst({
      where: { id, system: { orgId: user.orgId } },
      select: { id: true },
    });
    if (!existing) throw new HttpError(404, "Evidence request not found");

    const updated = await prisma.evidenceRequest.update({
      where: { id },
      data: {
        status: body.status,
        response: body.response ?? undefined,
        resolvedAt: body.status === "RESOLVED" ? new Date() : null,
      },
    });
    await writeAuditEvent({
      actorId: user.id,
      action: "evidence_request.update",
      entityType: "evidenceRequest",
      entityId: id,
      metadata: { status: updated.status },
    });
    return updated;
  });
}
