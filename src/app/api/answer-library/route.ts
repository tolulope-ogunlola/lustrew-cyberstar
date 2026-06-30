import { prisma } from "@/lib/db";
import { requireUser, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { answerLibrarySchema } from "@/lib/validation";

export async function GET() {
  return route(async () => {
    const user = await requireUser();
    const rows = await prisma.answerLibraryEntry.findMany({ where: { orgId: user.orgId }, orderBy: { category: "asc" } });
    return rows.map((r) => ({ ...r, tags: JSON.parse(r.tags || "[]"), sourceRefs: JSON.parse(r.sourceRefs || "[]") }));
  });
}

export async function POST(req: Request) {
  return route(async () => {
    const user = await requirePermission("write", "questionnaire");
    const body = answerLibrarySchema.parse(await req.json());
    const entry = await prisma.answerLibraryEntry.create({
      data: {
        orgId: user.orgId,
        question: body.question,
        answer: body.answer,
        category: body.category,
        tags: JSON.stringify(body.tags ?? []),
        status: body.status,
        lastReviewedAt: new Date(),
      },
    });
    await writeAuditEvent({ actorId: user.id, action: "answer_library.create", entityType: "questionnaire", entityId: entry.id, metadata: { category: entry.category } });
    return entry;
  });
}
