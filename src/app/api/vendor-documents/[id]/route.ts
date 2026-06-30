import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "vendor");
    const { id } = await params;
    const existing = await prisma.vendorDocument.findFirst({
      where: { id, vendor: { orgId: user.orgId } },
      include: { vendor: { select: { id: true } } },
    });
    if (!existing) throw new HttpError(404, "Document not found");
    await prisma.vendorDocument.delete({ where: { id } });
    await writeAuditEvent({ actorId: user.id, action: "vendor.document.delete", entityType: "vendor", entityId: existing.vendor.id, metadata: { docId: id } });
    return { ok: true };
  });
}
