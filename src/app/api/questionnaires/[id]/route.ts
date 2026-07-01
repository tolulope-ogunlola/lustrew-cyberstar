import { prisma } from "@/lib/db";
import { HttpError, requireUser, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requireUser();
    const { id } = await params;
    const q = await prisma.questionnaire.findFirst({
      where: { id, orgId: user.orgId },
      include: { items: { orderBy: { rowIndex: "asc" } } },
    });
    if (!q) throw new HttpError(404, "Questionnaire not found");
    return q;
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "questionnaire");
    const { id } = await params;
    const existing = await prisma.questionnaire.findFirst({ where: { id, orgId: user.orgId }, select: { id: true } });
    if (!existing) throw new HttpError(404, "Questionnaire not found");
    await prisma.questionnaire.delete({ where: { id } });
    await writeAuditEvent({ actorId: user.id, action: "questionnaire.delete", entityType: "questionnaire", entityId: id });
    return { ok: true };
  });
}
