import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { vendorReviewCreateSchema } from "@/lib/validation";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "vendor");
    const { id } = await params;
    const body = vendorReviewCreateSchema.parse(await req.json());

    const vendor = await prisma.vendor.findFirst({ where: { id, orgId: user.orgId }, select: { id: true } });
    if (!vendor) throw new HttpError(404, "Vendor not found");

    const review = await prisma.vendorReview.create({
      data: {
        vendorId: id,
        reviewType: body.reviewType,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        reviewerId: body.reviewerId || null,
      },
    });
    await writeAuditEvent({ actorId: user.id, action: "vendor.review.create", entityType: "vendor", entityId: id, metadata: { reviewId: review.id, type: review.reviewType } });
    return review;
  });
}
