import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { evidenceLinkSchema } from "@/lib/validation";
import { storage } from "@/lib/storage";

// PATCH -> replace the set of control implementations this evidence is linked to.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return route(async () => {
    const user = await requirePermission("write", "evidence");
    const { id } = await params;
    const body = evidenceLinkSchema.parse(await req.json());

    const evidence = await prisma.evidence.findFirst({
      where: { id, system: { orgId: user.orgId } },
      select: { id: true },
    });
    if (!evidence) throw new HttpError(404, "Evidence not found");

    await prisma.evidenceLink.deleteMany({ where: { evidenceId: id } });
    if (body.implementationIds.length) {
      await prisma.evidenceLink.createMany({
        data: body.implementationIds.map((implementationId) => ({
          evidenceId: id,
          implementationId,
        })),
      });
    }

    await writeAuditEvent({
      actorId: user.id,
      action: "evidence.relink",
      entityType: "evidence",
      entityId: id,
      metadata: { links: body.implementationIds.length },
    });

    return { ok: true };
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return route(async () => {
    const user = await requirePermission("write", "evidence");
    const { id } = await params;
    const evidence = await prisma.evidence.findFirst({
      where: { id, system: { orgId: user.orgId } },
      select: { id: true, fileRef: true },
    });
    if (!evidence) throw new HttpError(404, "Evidence not found");
    if (evidence.fileRef) await storage().delete(evidence.fileRef);
    await prisma.evidence.delete({ where: { id } });
    await writeAuditEvent({
      actorId: user.id,
      action: "evidence.delete",
      entityType: "evidence",
      entityId: id,
    });
    return { ok: true };
  });
}
