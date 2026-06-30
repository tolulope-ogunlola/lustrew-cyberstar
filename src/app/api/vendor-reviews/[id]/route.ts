import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { vendorReviewUpdateSchema } from "@/lib/validation";
import { computeNextReviewDate } from "@/lib/vendor";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "vendor");
    const { id } = await params;
    const body = vendorReviewUpdateSchema.parse(await req.json());

    const existing = await prisma.vendorReview.findFirst({
      where: { id, vendor: { orgId: user.orgId } },
      include: { vendor: { select: { id: true, reviewCadence: true } } },
    });
    if (!existing) throw new HttpError(404, "Review not found");

    const completing = body.status === "COMPLETED" && existing.status !== "COMPLETED";
    const now = new Date();

    const updated = await prisma.vendorReview.update({
      where: { id },
      data: {
        status: body.status,
        questionnaireSentAt:
          body.questionnaireSentAt === undefined ? undefined : body.questionnaireSentAt ? new Date(body.questionnaireSentAt) : null,
        questionnaireReceivedAt:
          body.questionnaireReceivedAt === undefined ? undefined : body.questionnaireReceivedAt ? new Date(body.questionnaireReceivedAt) : null,
        findings: body.findings,
        mitigationPlan: body.mitigationPlan,
        residualRiskRating: body.residualRiskRating,
        dueDate: body.dueDate === undefined ? undefined : body.dueDate ? new Date(body.dueDate) : null,
        reviewerId: body.reviewerId === undefined ? undefined : body.reviewerId || null,
        completedAt: completing ? now : undefined,
      },
    });

    // On completion, advance the vendor's next review date per its cadence.
    if (completing) {
      await prisma.vendor.update({
        where: { id: existing.vendor.id },
        data: { nextReviewDate: computeNextReviewDate(now, existing.vendor.reviewCadence) },
      });
    }

    await writeAuditEvent({
      actorId: user.id,
      action: completing ? "vendor.review.complete" : "vendor.review.update",
      entityType: "vendor",
      entityId: existing.vendor.id,
      metadata: { reviewId: id, status: updated.status },
    });
    return updated;
  });
}
