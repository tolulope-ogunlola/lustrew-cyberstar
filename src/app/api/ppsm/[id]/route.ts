import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { ppsmUpdateSchema } from "@/lib/validation";

async function assertEntry(orgId: string, id: string) {
  const e = await prisma.ppsmEntry.findFirst({ where: { id, system: { orgId } }, select: { id: true } });
  if (!e) throw new HttpError(404, "Entry not found");
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "ppsm");
    const { id } = await params;
    await assertEntry(user.orgId, id);
    const body = ppsmUpdateSchema.parse(await req.json());
    const updated = await prisma.ppsmEntry.update({
      where: { id },
      data: {
        port: body.port,
        protocol: body.protocol,
        service: body.service,
        direction: body.direction,
        source: body.source,
        destination: body.destination,
        justification: body.justification,
        status: body.status,
        associatedControl: body.associatedControl === undefined ? undefined : body.associatedControl,
      },
    });
    await writeAuditEvent({ actorId: user.id, action: "ppsm.update", entityType: "ppsmEntry", entityId: id, metadata: { status: updated.status } });
    return updated;
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "ppsm");
    const { id } = await params;
    await assertEntry(user.orgId, id);
    await prisma.ppsmEntry.delete({ where: { id } });
    await writeAuditEvent({ actorId: user.id, action: "ppsm.delete", entityType: "ppsmEntry", entityId: id });
    return { ok: true };
  });
}
