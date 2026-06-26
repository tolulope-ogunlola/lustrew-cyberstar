import { prisma } from "@/lib/db";
import { HttpError, requireUser, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { poamUpdateSchema } from "@/lib/validation";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return route(async () => {
    const user = await requireUser();
    const { id } = await params;
    const poam = await prisma.poam.findFirst({
      where: { id, system: { orgId: user.orgId } },
      include: {
        system: { select: { id: true, name: true } },
        owner: { select: { name: true } },
        implementation: { include: { control: { select: { controlId: true, title: true } } } },
        milestones: { orderBy: { dueDate: "asc" } },
        statusHistory: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!poam) throw new HttpError(404, "POA&M not found");
    return poam;
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return route(async () => {
    const user = await requirePermission("write", "poam");
    const { id } = await params;
    const body = poamUpdateSchema.parse(await req.json());

    const existing = await prisma.poam.findFirst({
      where: { id, system: { orgId: user.orgId } },
    });
    if (!existing) throw new HttpError(404, "POA&M not found");

    const statusChanged = body.status && body.status !== existing.status;

    const updated = await prisma.poam.update({
      where: { id },
      data: {
        weaknessTitle: body.weaknessTitle,
        weaknessDescription: body.weaknessDescription,
        severity: body.severity,
        riskRating: body.riskRating,
        cvss: body.cvss === undefined ? undefined : body.cvss,
        status: body.status,
        remediationPlan: body.remediationPlan,
        residualRisk: body.residualRisk,
        ownerId: body.ownerId === undefined ? undefined : body.ownerId,
        scheduledCompletion:
          body.scheduledCompletion === undefined
            ? undefined
            : body.scheduledCompletion
              ? new Date(body.scheduledCompletion)
              : null,
        // Stamp completion when moved to a terminal state.
        actualCompletion:
          statusChanged && (body.status === "COMPLETED" || body.status === "CLOSED")
            ? new Date()
            : undefined,
        // Append-only history row on status change.
        ...(statusChanged
          ? {
              statusHistory: {
                create: {
                  status: body.status!,
                  note: body.statusNote ?? "",
                  changedBy: user.id,
                },
              },
            }
          : {}),
      },
    });

    await writeAuditEvent({
      actorId: user.id,
      action: statusChanged ? "poam.status_change" : "poam.update",
      entityType: "poam",
      entityId: id,
      metadata: { poamNumber: updated.poamNumber, status: updated.status },
    });

    return updated;
  });
}
