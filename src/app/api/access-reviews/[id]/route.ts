import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { accessReviewUpdateSchema } from "@/lib/validation";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "personnel");
    const { id } = await params;
    const body = accessReviewUpdateSchema.parse(await req.json());

    const existing = await prisma.accessReview.findFirst({
      where: { id, personnel: { orgId: user.orgId } },
      select: { id: true, status: true, personnelId: true },
    });
    if (!existing) throw new HttpError(404, "Access review not found");

    const certifying = (body.status === "CERTIFIED" || body.status === "REVOKED") && existing.status !== body.status;
    const updated = await prisma.accessReview.update({
      where: { id },
      data: {
        status: body.status,
        decision: body.decision,
        dueDate: body.dueDate === undefined ? undefined : body.dueDate ? new Date(body.dueDate) : null,
        reviewerId: body.reviewerId === undefined ? undefined : body.reviewerId || null,
        notes: body.notes,
        reviewedAt: certifying ? new Date() : undefined,
      },
    });
    await writeAuditEvent({ actorId: user.id, action: "personnel.access_review.update", entityType: "personnel", entityId: existing.personnelId, metadata: { reviewId: id, status: updated.status } });
    return updated;
  });
}
