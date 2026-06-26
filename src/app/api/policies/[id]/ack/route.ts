import { prisma } from "@/lib/db";
import { HttpError, requireUser, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";

// Any authenticated user can acknowledge a policy they can see. Idempotent (unique per policy+user).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requireUser();
    const { id } = await params;
    const policy = await prisma.policy.findFirst({ where: { id, orgId: user.orgId }, select: { id: true } });
    if (!policy) throw new HttpError(404, "Policy not found");

    await prisma.policyAck.upsert({
      where: { policyId_userId: { policyId: id, userId: user.id } },
      create: { policyId: id, userId: user.id, userName: user.name },
      update: {},
    });

    await writeAuditEvent({ actorId: user.id, action: "policy.acknowledge", entityType: "policy", entityId: id });
    return { acknowledged: true };
  });
}
