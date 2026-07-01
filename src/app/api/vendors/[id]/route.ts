import { prisma } from "@/lib/db";
import { HttpError, requireUser, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { vendorUpdateSchema } from "@/lib/validation";
import { isReviewOverdue } from "@/lib/vendor";

async function getOwned(id: string, orgId: string) {
  return prisma.vendor.findFirst({ where: { id, orgId } });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requireUser();
    const { id } = await params;
    const vendor = await prisma.vendor.findFirst({
      where: { id, orgId: user.orgId },
      include: {
        owner: { select: { name: true } },
        reviews: { orderBy: { createdAt: "desc" }, include: { reviewer: { select: { name: true } } } },
        documents: { orderBy: { createdAt: "desc" }, include: { evidence: { select: { id: true, title: true } } } },
      },
    });
    if (!vendor) throw new HttpError(404, "Vendor not found");
    return { ...vendor, reviewOverdue: isReviewOverdue(vendor.nextReviewDate) };
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "vendor");
    const { id } = await params;
    const body = vendorUpdateSchema.parse(await req.json());
    const existing = await getOwned(id, user.orgId);
    if (!existing) throw new HttpError(404, "Vendor not found");

    const updated = await prisma.vendor.update({
      where: { id },
      data: {
        name: body.name,
        businessPurpose: body.businessPurpose,
        dataSensitivity: body.dataSensitivity,
        criticality: body.criticality,
        status: body.status,
        reviewCadence: body.reviewCadence,
        riskRating: body.riskRating,
        nextReviewDate:
          body.nextReviewDate === undefined ? undefined : body.nextReviewDate ? new Date(body.nextReviewDate) : null,
        renewalDate: body.renewalDate === undefined ? undefined : body.renewalDate ? new Date(body.renewalDate) : null,
        contactName: body.contactName,
        contactEmail: body.contactEmail,
        website: body.website,
        hasDpa: body.hasDpa,
        dpaExpiresAt: body.dpaExpiresAt === undefined ? undefined : body.dpaExpiresAt ? new Date(body.dpaExpiresAt) : null,
        ownerId: body.ownerId === undefined ? undefined : body.ownerId || null,
      },
    });
    await writeAuditEvent({ actorId: user.id, action: "vendor.update", entityType: "vendor", entityId: id, metadata: { name: updated.name } });
    return updated;
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "vendor");
    const { id } = await params;
    const existing = await getOwned(id, user.orgId);
    if (!existing) throw new HttpError(404, "Vendor not found");
    await prisma.vendor.delete({ where: { id } });
    await writeAuditEvent({ actorId: user.id, action: "vendor.delete", entityType: "vendor", entityId: id, metadata: { name: existing.name } });
    return { ok: true };
  });
}
