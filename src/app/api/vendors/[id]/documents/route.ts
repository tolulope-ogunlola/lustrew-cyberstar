import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { vendorDocumentCreateSchema } from "@/lib/validation";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "vendor");
    const { id } = await params;
    const body = vendorDocumentCreateSchema.parse(await req.json());

    const vendor = await prisma.vendor.findFirst({ where: { id, orgId: user.orgId }, select: { id: true } });
    if (!vendor) throw new HttpError(404, "Vendor not found");

    // If linking an existing evidence artifact, confirm it belongs to this org.
    if (body.evidenceId) {
      const ev = await prisma.evidence.findFirst({ where: { id: body.evidenceId, system: { orgId: user.orgId } }, select: { id: true } });
      if (!ev) throw new HttpError(404, "Evidence not found in your organization");
    }

    const doc = await prisma.vendorDocument.create({
      data: {
        vendorId: id,
        docType: body.docType,
        title: body.title,
        url: body.url ?? "",
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
        note: body.note ?? "",
        evidenceId: body.evidenceId || null,
      },
    });
    await writeAuditEvent({ actorId: user.id, action: "vendor.document.create", entityType: "vendor", entityId: id, metadata: { docId: doc.id, docType: doc.docType } });
    return doc;
  });
}
