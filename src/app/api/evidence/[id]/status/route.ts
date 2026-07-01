import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAuditEvent } from "@/lib/audit";
import { evidenceStatusSchema } from "@/lib/validation";
import { canTransition } from "@/lib/evidence";

// PATCH /api/evidence/[id]/status — move evidence through its approval lifecycle.
// Authors (write evidence) may submit/withdraw/re-collect; only approvers (write evidenceApproval)
// may move evidence into UNDER_REVIEW / APPROVED / REJECTED (separation of duties).
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return route(async () => {
    const user = await requirePermission("write", "evidence");
    const { id } = await params;
    const body = evidenceStatusSchema.parse(await req.json());

    const existing = await prisma.evidence.findFirst({
      where: { id, system: { orgId: user.orgId } },
      select: { id: true, title: true, approvalStatus: true },
    });
    if (!existing) throw new HttpError(404, "Evidence not found");

    const asApprover = can(user.role, "write", "evidenceApproval");
    if (existing.approvalStatus === body.approvalStatus) {
      throw new HttpError(400, "Evidence is already in that status");
    }
    if (!canTransition(existing.approvalStatus, body.approvalStatus, asApprover)) {
      throw new HttpError(403, `Not permitted: ${existing.approvalStatus} → ${body.approvalStatus}`);
    }

    const isReview = body.approvalStatus === "APPROVED" || body.approvalStatus === "REJECTED";
    const updated = await prisma.evidence.update({
      where: { id },
      data: {
        approvalStatus: body.approvalStatus,
        reviewNote: body.reviewNote ?? undefined,
        reviewedAt: isReview ? new Date() : undefined,
        reviewerId: isReview ? user.id : undefined,
        statusHistory: {
          create: { status: body.approvalStatus, note: body.reviewNote ?? "", changedBy: user.id },
        },
      },
    });

    await writeAuditEvent({
      actorId: user.id,
      action: "evidence.status_change",
      entityType: "evidence",
      entityId: id,
      metadata: { title: existing.title, from: existing.approvalStatus, to: updated.approvalStatus },
    });

    return { id: updated.id, approvalStatus: updated.approvalStatus };
  });
}
