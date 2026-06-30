import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { draftQuestionnaireAnswer } from "@/lib/ai/questionnaire";
import type { LibraryCandidate } from "@/lib/questionnaire/match";

// POST: auto-draft answers for all not-yet-approved items using the answer library + AI.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "questionnaire");
    const { id } = await params;

    const q = await prisma.questionnaire.findFirst({
      where: { id, orgId: user.orgId },
      include: { items: { where: { status: { in: ["PENDING", "DRAFTED", "NEEDS_INPUT"] } } } },
    });
    if (!q) throw new HttpError(404, "Questionnaire not found");

    const libraryRows = await prisma.answerLibraryEntry.findMany({
      where: { orgId: user.orgId, status: "APPROVED" },
      select: { id: true, question: true, answer: true, sourceRefs: true },
    });
    const library: LibraryCandidate[] = libraryRows;

    let drafted = 0;
    let usedAi = false;
    for (const item of q.items) {
      const d = await draftQuestionnaireAnswer({ question: item.question, customer: q.customer, library });
      if (d.source === "AI" && d.text) usedAi = true;
      await prisma.questionnaireItem.update({
        where: { id: item.id },
        data: {
          draftAnswer: d.text,
          status: d.confidence === 0 ? "NEEDS_INPUT" : "DRAFTED",
          confidence: d.confidence,
          source: d.source,
          sourceRefs: d.sourceRefs,
          libraryEntryId: d.usedLibraryEntryId ?? null,
        },
      });
      drafted++;
    }

    await prisma.questionnaire.update({ where: { id }, data: { status: "IN_REVIEW" } });
    await writeAuditEvent({ actorId: user.id, action: "questionnaire.draft", entityType: "questionnaire", entityId: id, metadata: { drafted } });
    return { drafted, usedAi };
  });
}
