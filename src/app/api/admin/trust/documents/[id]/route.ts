import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "trustcenter");
    const { id } = await params;
    const existing = await prisma.trustDocument.findFirst({ where: { id, orgId: user.orgId }, select: { id: true, title: true } });
    if (!existing) throw new HttpError(404, "Document not found");
    await prisma.trustDocument.delete({ where: { id } });
    await writeAuditEvent({ actorId: user.id, action: "trustcenter.document.delete", entityType: "trustcenter", entityId: id, metadata: { title: existing.title } });
    return { ok: true };
  });
}
