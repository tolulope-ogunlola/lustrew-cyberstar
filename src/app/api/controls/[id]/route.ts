import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { implementationUpdateSchema } from "@/lib/validation";

// GET a single implementation (with control + linked evidence).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return route(async () => {
    const user = await requirePermission("read", "control");
    const { id } = await params;
    const impl = await prisma.controlImplementation.findFirst({
      where: { id, system: { orgId: user.orgId } },
      include: {
        control: true,
        system: { select: { id: true, name: true, fipsCategory: true } },
        owner: { select: { name: true } },
        evidenceLinks: { include: { evidence: { select: { id: true, title: true, type: true } } } },
      },
    });
    if (!impl) throw new HttpError(404, "Implementation not found");
    return impl;
  });
}

// PATCH status / scoping / narrative / owner.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return route(async () => {
    const user = await requirePermission("write", "control");
    const { id } = await params;
    const body = implementationUpdateSchema.parse(await req.json());

    const existing = await prisma.controlImplementation.findFirst({
      where: { id, system: { orgId: user.orgId } },
      include: { control: { select: { controlId: true } } },
    });
    if (!existing) throw new HttpError(404, "Implementation not found");

    const updated = await prisma.controlImplementation.update({
      where: { id },
      data: {
        scoping: body.scoping,
        status: body.status,
        narrative: body.narrative,
        providerName: body.providerName,
        ownerId: body.ownerId === undefined ? undefined : body.ownerId,
      },
    });

    await writeAuditEvent({
      actorId: user.id,
      action: "control.update",
      entityType: "controlImplementation",
      entityId: id,
      metadata: { control: existing.control.controlId, status: updated.status, scoping: updated.scoping },
    });

    return updated;
  });
}
