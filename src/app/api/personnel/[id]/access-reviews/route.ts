import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { accessReviewCreateSchema } from "@/lib/validation";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "personnel");
    const { id } = await params;
    const body = accessReviewCreateSchema.parse(await req.json());

    const person = await prisma.personnel.findFirst({ where: { id, orgId: user.orgId }, select: { id: true } });
    if (!person) throw new HttpError(404, "Personnel not found");

    const review = await prisma.accessReview.create({
      data: {
        personnelId: id,
        scope: body.scope ?? "",
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        reviewerId: body.reviewerId || null,
      },
    });
    await writeAuditEvent({ actorId: user.id, action: "personnel.access_review.create", entityType: "personnel", entityId: id, metadata: { reviewId: review.id } });
    return review;
  });
}
