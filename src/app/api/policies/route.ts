import { prisma } from "@/lib/db";
import { requireUser, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { policyCreateSchema } from "@/lib/validation";

// Org policy library, with each policy's acknowledgement state for the current user.
export async function GET() {
  return route(async () => {
    const user = await requireUser();
    const policies = await prisma.policy.findMany({
      where: { orgId: user.orgId },
      orderBy: { createdAt: "desc" },
      include: { acks: { select: { userId: true, userName: true } } },
    });
    return policies.map((p) => ({
      ...p,
      ackCount: p.acks.length,
      acknowledgedByMe: p.acks.some((a) => a.userId === user.id),
      acks: undefined,
    }));
  });
}

export async function POST(req: Request) {
  return route(async () => {
    const user = await requirePermission("write", "policy");
    const body = policyCreateSchema.parse(await req.json());
    const policy = await prisma.policy.create({
      data: {
        orgId: user.orgId,
        title: body.title,
        framework: body.framework,
        version: body.version,
        status: body.status,
        body: body.body ?? "",
        url: body.url ?? "",
        ownerId: body.ownerId || null,
        reviewDate: body.reviewDate ? new Date(body.reviewDate) : null,
      },
    });
    await writeAuditEvent({ actorId: user.id, action: "policy.create", entityType: "policy", entityId: policy.id, metadata: { title: policy.title } });
    return policy;
  });
}
