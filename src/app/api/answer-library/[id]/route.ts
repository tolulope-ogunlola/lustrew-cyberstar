import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { answerLibraryUpdateSchema } from "@/lib/validation";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "questionnaire");
    const { id } = await params;
    const body = answerLibraryUpdateSchema.parse(await req.json());
    const existing = await prisma.answerLibraryEntry.findFirst({ where: { id, orgId: user.orgId }, select: { id: true } });
    if (!existing) throw new HttpError(404, "Answer not found");
    const updated = await prisma.answerLibraryEntry.update({
      where: { id },
      data: {
        question: body.question,
        answer: body.answer,
        category: body.category,
        tags: body.tags === undefined ? undefined : JSON.stringify(body.tags),
        status: body.status,
        lastReviewedAt: new Date(),
      },
    });
    await writeAuditEvent({ actorId: user.id, action: "answer_library.update", entityType: "questionnaire", entityId: id });
    return updated;
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "questionnaire");
    const { id } = await params;
    const existing = await prisma.answerLibraryEntry.findFirst({ where: { id, orgId: user.orgId }, select: { id: true } });
    if (!existing) throw new HttpError(404, "Answer not found");
    await prisma.answerLibraryEntry.delete({ where: { id } });
    await writeAuditEvent({ actorId: user.id, action: "answer_library.delete", entityType: "questionnaire", entityId: id });
    return { ok: true };
  });
}
