import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { riskUpdateSchema } from "@/lib/validation";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return route(async () => {
    const user = await requirePermission("write", "risk");
    const { id } = await params;
    const body = riskUpdateSchema.parse(await req.json());

    const existing = await prisma.risk.findFirst({
      where: { id, system: { orgId: user.orgId } },
      select: { id: true, status: true, riskNumber: true },
    });
    if (!existing) throw new HttpError(404, "Risk not found");

    // Require an approval authority before a risk can be formally accepted.
    if (body.status === "ACCEPTED" && !(body.approvalAuthority ?? "").trim()) {
      throw new HttpError(400, "Risk acceptance requires an approval authority");
    }

    const updated = await prisma.risk.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
        threat: body.threat,
        vulnerabilityNarrative: body.vulnerabilityNarrative,
        likelihood: body.likelihood,
        impact: body.impact,
        residualLikelihood: body.residualLikelihood,
        residualImpact: body.residualImpact,
        status: body.status,
        mitigationPlan: body.mitigationPlan,
        acceptanceDecision: body.acceptanceDecision,
        approvalAuthority: body.approvalAuthority,
        targetDate:
          body.targetDate === undefined ? undefined : body.targetDate ? new Date(body.targetDate) : null,
        ownerId: body.ownerId === undefined ? undefined : body.ownerId,
        relatedControl: body.relatedControl === undefined ? undefined : body.relatedControl,
        relatedPoamId: body.relatedPoamId === undefined ? undefined : body.relatedPoamId,
        relatedVulnId: body.relatedVulnId === undefined ? undefined : body.relatedVulnId,
      },
    });

    const statusChanged = body.status && body.status !== existing.status;
    await writeAuditEvent({
      actorId: user.id,
      action: statusChanged ? "risk.status_change" : "risk.update",
      entityType: "risk",
      entityId: id,
      metadata: { riskNumber: updated.riskNumber, status: updated.status },
    });

    return updated;
  });
}
