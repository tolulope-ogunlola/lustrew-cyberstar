import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { policyUpdateSchema } from "@/lib/validation";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "policy");
    const { id } = await params;
    const body = policyUpdateSchema.parse(await req.json());
    const policy = await prisma.policy.findFirst({ where: { id, orgId: user.orgId }, select: { id: true } });
    if (!policy) throw new HttpError(404, "Policy not found");

    const updated = await prisma.policy.update({
      where: { id },
      data: {
        title: body.title,
        framework: body.framework,
        version: body.version,
        status: body.status,
        body: body.body,
        url: body.url,
        ownerId: body.ownerId === undefined ? undefined : body.ownerId,
        reviewDate: body.reviewDate === undefined ? undefined : body.reviewDate ? new Date(body.reviewDate) : null,
      },
    });
    await writeAuditEvent({ actorId: user.id, action: "policy.update", entityType: "policy", entityId: id, metadata: { status: updated.status } });
    return updated;
  });
}
