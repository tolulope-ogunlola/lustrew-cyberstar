import { prisma } from "@/lib/db";
import { HttpError, requireUser, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { rmfUpdateSchema } from "@/lib/validation";

const ORDER = [
  "PREPARE",
  "CATEGORIZE",
  "SELECT",
  "IMPLEMENT",
  "ASSESS",
  "AUTHORIZE",
  "MONITOR",
];

async function assertSystem(orgId: string, systemId: string) {
  const system = await prisma.system.findFirst({
    where: { id: systemId, orgId },
    select: { id: true },
  });
  if (!system) throw new HttpError(404, "System not found");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ systemId: string }> }
) {
  return route(async () => {
    const user = await requireUser();
    const { systemId } = await params;
    await assertSystem(user.orgId, systemId);
    const steps = await prisma.rmfStep.findMany({
      where: { systemId },
      include: { owner: { select: { name: true } } },
    });
    steps.sort((a, b) => ORDER.indexOf(a.step) - ORDER.indexOf(b.step));
    return steps;
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ systemId: string }> }
) {
  return route(async () => {
    const user = await requirePermission("write", "rmf");
    const { systemId } = await params;
    await assertSystem(user.orgId, systemId);
    const body = rmfUpdateSchema.parse(await req.json());

    const updated = await prisma.rmfStep.update({
      where: { systemId_step: { systemId, step: body.step } },
      data: {
        status: body.status,
        ownerId: body.ownerId === undefined ? undefined : body.ownerId,
        dueDate: body.dueDate === undefined ? undefined : body.dueDate ? new Date(body.dueDate) : null,
        notes: body.notes,
      },
    });

    await writeAuditEvent({
      actorId: user.id,
      action: "rmf.update",
      entityType: "rmfStep",
      entityId: updated.id,
      metadata: { systemId, step: body.step, status: updated.status },
    });

    return updated;
  });
}
