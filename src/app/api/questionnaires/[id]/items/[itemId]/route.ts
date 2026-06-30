import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { questionnaireItemUpdateSchema } from "@/lib/validation";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "questionnaire");
    const { id, itemId } = await params;
    const body = questionnaireItemUpdateSchema.parse(await req.json());

    const item = await prisma.questionnaireItem.findFirst({
      where: { id: itemId, questionnaireId: id, questionnaire: { orgId: user.orgId } },
      select: { id: true },
    });
    if (!item) throw new HttpError(404, "Item not found");

    // Approving copies the (possibly edited) answer into approvedAnswer.
    const approving = body.status === "APPROVED";
    const updated = await prisma.questionnaireItem.update({
      where: { id: itemId },
      data: {
        draftAnswer: body.draftAnswer,
        approvedAnswer: approving ? (body.approvedAnswer ?? body.draftAnswer) : body.approvedAnswer,
        status: body.status,
        source: approving && !body.draftAnswer ? "MANUAL" : undefined,
      },
    });
    await writeAuditEvent({ actorId: user.id, action: "questionnaire.item.update", entityType: "questionnaire", entityId: id, metadata: { itemId, status: updated.status } });
    return updated;
  });
}
