import { prisma } from "@/lib/db";
import { HttpError, requirePermission, requireUser, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { authorizationCreateSchema } from "@/lib/validation";

// GET /api/authorizations?systemId=X — authorization decision history (newest first).
export async function GET(req: Request) {
  return route(async () => {
    const user = await requireUser();
    const systemId = new URL(req.url).searchParams.get("systemId");
    if (!systemId) throw new HttpError(400, "systemId is required");
    const system = await prisma.system.findFirst({ where: { id: systemId, orgId: user.orgId }, select: { id: true } });
    if (!system) throw new HttpError(404, "System not found");

    return prisma.authorizationDecision.findMany({
      where: { systemId },
      orderBy: { decisionDate: "desc" },
      include: { signedBy: { select: { name: true, email: true } } },
    });
  });
}

// POST /api/authorizations — record an Authorizing Official decision (ATO sign-off).
export async function POST(req: Request) {
  return route(async () => {
    const user = await requirePermission("write", "authorization");
    const body = authorizationCreateSchema.parse(await req.json());

    const system = await prisma.system.findFirst({ where: { id: body.systemId, orgId: user.orgId }, select: { id: true } });
    if (!system) throw new HttpError(404, "System not found");

    const decision = await prisma.authorizationDecision.create({
      data: {
        systemId: body.systemId,
        decision: body.decision,
        authorizingOfficial: body.authorizingOfficial,
        decisionDate: body.decisionDate ? new Date(body.decisionDate) : new Date(),
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        rationale: body.rationale ?? "",
        conditions: body.conditions ?? "",
        signedById: user.id,
      },
      include: { signedBy: { select: { name: true, email: true } } },
    });

    await writeAuditEvent({
      actorId: user.id,
      action: "authorization.decision",
      entityType: "authorization",
      entityId: decision.id,
      metadata: { systemId: body.systemId, decision: body.decision, ao: body.authorizingOfficial },
    });

    return decision;
  });
}
