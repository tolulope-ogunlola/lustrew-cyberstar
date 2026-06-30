import { prisma } from "@/lib/db";
import { HttpError, requireUser, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { trustDocumentSchema } from "@/lib/validation";

export async function GET() {
  return route(async () => {
    const user = await requireUser();
    const tc = await prisma.trustCenter.findUnique({ where: { orgId: user.orgId }, select: { id: true } });
    if (!tc) return [];
    return prisma.trustDocument.findMany({
      where: { trustCenterId: tc.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { grants: true } } },
    });
  });
}

export async function POST(req: Request) {
  return route(async () => {
    const user = await requirePermission("write", "trustcenter");
    const body = trustDocumentSchema.parse(await req.json());
    const tc = await prisma.trustCenter.findUnique({ where: { orgId: user.orgId }, select: { id: true } });
    if (!tc) throw new HttpError(400, "Configure the Trust Center first");

    // Link an existing evidence artifact (reuses its secure storage ref) if provided.
    let fileRef: string | null = null, fileName: string | null = null, contentType: string | null = null, fileSize: number | null = null;
    if (body.evidenceId) {
      const ev = await prisma.evidence.findFirst({ where: { id: body.evidenceId, system: { orgId: user.orgId } }, select: { fileRef: true, fileName: true, contentType: true, fileSize: true } });
      if (!ev) throw new HttpError(404, "Evidence not found in your organization");
      fileRef = ev.fileRef; fileName = ev.fileName; contentType = ev.contentType; fileSize = ev.fileSize;
    }

    const doc = await prisma.trustDocument.create({
      data: {
        trustCenterId: tc.id,
        orgId: user.orgId,
        title: body.title,
        category: body.category,
        visibility: body.visibility,
        requiresNda: body.visibility === "GATED" ? body.requiresNda : false,
        evidenceId: body.evidenceId || null,
        fileRef,
        fileName,
        contentType,
        fileSize,
      },
    });
    await writeAuditEvent({ actorId: user.id, action: "trustcenter.document.create", entityType: "trustcenter", entityId: doc.id, metadata: { title: doc.title, visibility: doc.visibility } });
    return doc;
  });
}
