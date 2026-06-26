import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { assessmentResultUpdateSchema } from "@/lib/validation";

// PATCH /api/assessments/[id]/results/[resultId] — record an assessor's finding for one control.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; resultId: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "assessment");
    const { id, resultId } = await params;
    const body = assessmentResultUpdateSchema.parse(await req.json());

    // Ownership: the result must belong to this assessment, which must belong to the user's org.
    const result = await prisma.controlAssessmentResult.findFirst({
      where: { id: resultId, assessmentId: id, assessment: { system: { orgId: user.orgId } } },
      select: { id: true },
    });
    if (!result) throw new HttpError(404, "Result not found");

    return prisma.controlAssessmentResult.update({
      where: { id: resultId },
      data: {
        result: body.result ?? undefined,
        findings: body.findings ?? undefined,
        recommendation: body.recommendation ?? undefined,
      },
    });
  });
}
