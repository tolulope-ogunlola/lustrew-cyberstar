import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { checkAssignUpdateSchema } from "@/lib/validation";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "check");
    const { id } = await params;
    const body = checkAssignUpdateSchema.parse(await req.json());
    const existing = await prisma.checkAssignment.findFirst({ where: { id, orgId: user.orgId }, select: { id: true } });
    if (!existing) throw new HttpError(404, "Assignment not found");
    const updated = await prisma.checkAssignment.update({
      where: { id },
      data: {
        enabled: body.enabled,
        integrationId: body.integrationId === undefined ? undefined : body.integrationId || null,
        paramsJson: body.params === undefined ? undefined : JSON.stringify(body.params),
      },
    });
    await writeAuditEvent({ actorId: user.id, action: "check.assignment.update", entityType: "check", entityId: id, metadata: { enabled: updated.enabled } });
    return updated;
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "check");
    const { id } = await params;
    const existing = await prisma.checkAssignment.findFirst({ where: { id, orgId: user.orgId }, select: { id: true } });
    if (!existing) throw new HttpError(404, "Assignment not found");
    await prisma.checkAssignment.delete({ where: { id } });
    await writeAuditEvent({ actorId: user.id, action: "check.assignment.delete", entityType: "check", entityId: id });
    return { ok: true };
  });
}
