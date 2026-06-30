import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { trainingAssignmentUpdateSchema } from "@/lib/validation";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "personnel");
    const { id } = await params;
    const body = trainingAssignmentUpdateSchema.parse(await req.json());

    const existing = await prisma.trainingAssignment.findFirst({
      where: { id, personnel: { orgId: user.orgId } },
      select: { id: true, status: true, personnelId: true },
    });
    if (!existing) throw new HttpError(404, "Assignment not found");

    const completing = body.status === "COMPLETED" && existing.status !== "COMPLETED";
    if (body.certificateEvidenceId) {
      const ev = await prisma.evidence.findFirst({ where: { id: body.certificateEvidenceId, system: { orgId: user.orgId } }, select: { id: true } });
      if (!ev) throw new HttpError(404, "Certificate evidence not found in your organization");
    }

    const updated = await prisma.trainingAssignment.update({
      where: { id },
      data: {
        status: body.status,
        dueDate: body.dueDate === undefined ? undefined : body.dueDate ? new Date(body.dueDate) : null,
        score: body.score === undefined ? undefined : body.score,
        certificateEvidenceId: body.certificateEvidenceId === undefined ? undefined : body.certificateEvidenceId || null,
        completedAt: completing ? new Date() : undefined,
      },
    });
    await writeAuditEvent({ actorId: user.id, action: "personnel.training.update", entityType: "personnel", entityId: existing.personnelId, metadata: { assignmentId: id, status: updated.status } });
    return updated;
  });
}
