import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";

// DELETE /api/assets/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "system");
    const { id } = await params;
    const asset = await prisma.asset.findFirst({ where: { id, system: { orgId: user.orgId } }, select: { id: true } });
    if (!asset) throw new HttpError(404, "Asset not found");
    await prisma.asset.delete({ where: { id } });
    await writeAuditEvent({ actorId: user.id, action: "asset.delete", entityType: "system", entityId: id });
    return { ok: true };
  });
}
