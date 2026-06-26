import { prisma } from "@/lib/db";
import { HttpError, requirePermission, requireUser, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { assessmentUpdateSchema } from "@/lib/validation";
import { canComplete, summarizeResults } from "@/lib/assessment";

async function loadOwned(id: string, orgId: string) {
  const assessment = await prisma.assessment.findFirst({
    where: { id, system: { orgId } },
    include: { results: { orderBy: { controlId: "asc" } }, system: { select: { id: true, name: true } } },
  });
  if (!assessment) throw new HttpError(404, "Assessment not found");
  return assessment;
}

// GET /api/assessments/[id] — assessment with its control results and a summary.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requireUser();
    const { id } = await params;
    const assessment = await loadOwned(id, user.orgId);
    return { ...assessment, summary_counts: summarizeResults(assessment.results) };
  });
}

// PATCH /api/assessments/[id] — update status/summary/assessor. Completing requires every
// applicable control to have been assessed.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "assessment");
    const { id } = await params;
    const body = assessmentUpdateSchema.parse(await req.json());
    const assessment = await loadOwned(id, user.orgId);

    if (body.status === "COMPLETED" && !canComplete(assessment.results)) {
      throw new HttpError(400, "Cannot complete: every applicable control must be assessed first.");
    }

    const updated = await prisma.assessment.update({
      where: { id },
      data: {
        status: body.status ?? undefined,
        summary: body.summary ?? undefined,
        assessorName: body.assessorName ?? undefined,
        completedAt: body.status === "COMPLETED" ? new Date() : body.status ? null : undefined,
      },
    });

    await writeAuditEvent({
      actorId: user.id,
      action: "assessment.update",
      entityType: "assessment",
      entityId: id,
      metadata: { status: updated.status },
    });

    return updated;
  });
}

// DELETE /api/assessments/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "assessment");
    const { id } = await params;
    await loadOwned(id, user.orgId);
    await prisma.assessment.delete({ where: { id } });
    await writeAuditEvent({ actorId: user.id, action: "assessment.delete", entityType: "assessment", entityId: id });
    return { ok: true };
  });
}
