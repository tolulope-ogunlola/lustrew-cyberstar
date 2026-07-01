import { prisma } from "@/lib/db";
import { requireUser, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { vendorCreateSchema } from "@/lib/validation";
import { vendorRiskRating, computeNextReviewDate, isReviewOverdue, formatVendorNumber } from "@/lib/vendor";

export async function GET() {
  return route(async () => {
    const user = await requireUser();
    const vendors = await prisma.vendor.findMany({
      where: { orgId: user.orgId },
      orderBy: { createdAt: "desc" },
      include: { owner: { select: { name: true } }, _count: { select: { reviews: true, documents: true } } },
    });
    const now = new Date();
    return vendors.map((v) => ({ ...v, reviewOverdue: isReviewOverdue(v.nextReviewDate, now) }));
  });
}

export async function POST(req: Request) {
  return route(async () => {
    const user = await requirePermission("write", "vendor");
    const body = vendorCreateSchema.parse(await req.json());

    const count = await prisma.vendor.count({ where: { orgId: user.orgId } });
    const now = new Date();
    const vendor = await prisma.vendor.create({
      data: {
        orgId: user.orgId,
        vendorNumber: formatVendorNumber(count + 1),
        name: body.name,
        businessPurpose: body.businessPurpose ?? "",
        dataSensitivity: body.dataSensitivity,
        criticality: body.criticality,
        status: body.status,
        reviewCadence: body.reviewCadence,
        riskRating: body.riskRating ?? vendorRiskRating(body.dataSensitivity, body.criticality),
        nextReviewDate: body.nextReviewDate
          ? new Date(body.nextReviewDate)
          : computeNextReviewDate(now, body.reviewCadence),
        renewalDate: body.renewalDate ? new Date(body.renewalDate) : null,
        contactName: body.contactName ?? "",
        contactEmail: body.contactEmail ?? "",
        website: body.website ?? "",
        hasDpa: body.hasDpa ?? false,
        dpaExpiresAt: body.dpaExpiresAt ? new Date(body.dpaExpiresAt) : null,
        ownerId: body.ownerId || null,
      },
    });

    await writeAuditEvent({
      actorId: user.id,
      action: "vendor.create",
      entityType: "vendor",
      entityId: vendor.id,
      metadata: { vendorNumber: vendor.vendorNumber, name: vendor.name },
    });
    return vendor;
  });
}
