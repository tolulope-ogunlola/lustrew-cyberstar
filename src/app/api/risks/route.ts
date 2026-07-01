import { prisma } from "@/lib/db";
import { HttpError, requireUser, requirePermission, route, requireSystemAccess, scopedSystemIds } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { riskCreateSchema } from "@/lib/validation";
import { assessRisk } from "@/lib/risk";

// GET /api/risks            -> all risks across the org
// GET /api/risks?systemId=X -> risks for one system (with computed inherent/residual scores)
export async function GET(req: Request) {
  return route(async () => {
    const user = await requireUser();
    const systemId = new URL(req.url).searchParams.get("systemId");
    if (systemId) await requireSystemAccess(user, systemId, "risks");
    const scoped = await scopedSystemIds(user); // external auditors: limit to engagement systems

    const risks = await prisma.risk.findMany({
      where: { system: { orgId: user.orgId }, ...(systemId ? { systemId } : scoped ? { systemId: { in: scoped } } : {}) },
      orderBy: { createdAt: "desc" },
      include: {
        system: { select: { id: true, name: true } },
        owner: { select: { name: true } },
      },
    });

    return risks.map((r) => ({ ...r, ...assessRisk(r) }));
  });
}

async function nextRiskNumber(orgId: string): Promise<string> {
  const count = await prisma.risk.count({ where: { system: { orgId } } });
  return `RISK-${String(count + 1).padStart(4, "0")}`;
}

export async function POST(req: Request) {
  return route(async () => {
    const user = await requirePermission("write", "risk");
    const body = riskCreateSchema.parse(await req.json());

    const system = await prisma.system.findFirst({
      where: { id: body.systemId, orgId: user.orgId },
      select: { id: true },
    });
    if (!system) throw new HttpError(404, "System not found");

    const risk = await prisma.risk.create({
      data: {
        riskNumber: await nextRiskNumber(user.orgId),
        systemId: body.systemId,
        title: body.title,
        description: body.description ?? "",
        threat: body.threat ?? "",
        vulnerabilityNarrative: body.vulnerabilityNarrative ?? "",
        likelihood: body.likelihood,
        impact: body.impact,
        residualLikelihood: body.residualLikelihood,
        residualImpact: body.residualImpact,
        mitigationPlan: body.mitigationPlan ?? "",
        targetDate: body.targetDate ? new Date(body.targetDate) : null,
        ownerId: body.ownerId || null,
        relatedControl: body.relatedControl || null,
        relatedPoamId: body.relatedPoamId || null,
        relatedVulnId: body.relatedVulnId || null,
      },
    });

    await writeAuditEvent({
      actorId: user.id,
      action: "risk.create",
      entityType: "risk",
      entityId: risk.id,
      metadata: { riskNumber: risk.riskNumber, likelihood: risk.likelihood, impact: risk.impact },
    });

    return risk;
  });
}
