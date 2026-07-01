import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { auditEngagementUpdateSchema } from "@/lib/validation";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "auditEngagement");
    const { id } = await params;
    const body = auditEngagementUpdateSchema.parse(await req.json());
    const existing = await prisma.auditEngagement.findFirst({ where: { id, orgId: user.orgId }, select: { id: true } });
    if (!existing) throw new HttpError(404, "Engagement not found");

    const updated = await prisma.auditEngagement.update({
      where: { id },
      data: {
        status: body.status,
        scopes: body.scopes === undefined ? undefined : JSON.stringify(body.scopes),
        expiresAt: body.expiresInDays === undefined ? undefined : new Date(Date.now() + body.expiresInDays * 86_400_000),
      },
    });
    await writeAuditEvent({ actorId: user.id, action: "audit_engagement.update", entityType: "auditEngagement", entityId: id, metadata: { status: updated.status } });
    return updated;
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "auditEngagement");
    const { id } = await params;
    const existing = await prisma.auditEngagement.findFirst({ where: { id, orgId: user.orgId }, select: { id: true } });
    if (!existing) throw new HttpError(404, "Engagement not found");
    await prisma.auditEngagement.delete({ where: { id } });
    await writeAuditEvent({ actorId: user.id, action: "audit_engagement.delete", entityType: "auditEngagement", entityId: id });
    return { ok: true };
  });
}
