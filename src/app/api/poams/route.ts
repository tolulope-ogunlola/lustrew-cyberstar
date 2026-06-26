import { prisma } from "@/lib/db";
import { HttpError, requireUser, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { poamCreateSchema } from "@/lib/validation";

// GET /api/poams           -> all POA&Ms across the org
// GET /api/poams?systemId=X -> POA&Ms for one system
export async function GET(req: Request) {
  return route(async () => {
    const user = await requireUser();
    const systemId = new URL(req.url).searchParams.get("systemId");
    return prisma.poam.findMany({
      where: { system: { orgId: user.orgId }, ...(systemId ? { systemId } : {}) },
      orderBy: { createdAt: "desc" },
      include: {
        system: { select: { id: true, name: true } },
        owner: { select: { name: true } },
        implementation: { include: { control: { select: { controlId: true } } } },
        milestones: true,
      },
    });
  });
}

async function nextPoamNumber(orgId: string): Promise<string> {
  const count = await prisma.poam.count({ where: { system: { orgId } } });
  return `POAM-${String(count + 1).padStart(4, "0")}`;
}

export async function POST(req: Request) {
  return route(async () => {
    const user = await requirePermission("write", "poam");
    const body = poamCreateSchema.parse(await req.json());

    const system = await prisma.system.findFirst({
      where: { id: body.systemId, orgId: user.orgId },
      select: { id: true },
    });
    if (!system) throw new HttpError(404, "System not found");

    const poam = await prisma.poam.create({
      data: {
        poamNumber: await nextPoamNumber(user.orgId),
        systemId: body.systemId,
        weaknessTitle: body.weaknessTitle,
        weaknessDescription: body.weaknessDescription ?? "",
        source: body.source,
        severity: body.severity,
        riskRating: body.riskRating,
        cvss: body.cvss ?? null,
        remediationPlan: body.remediationPlan ?? "",
        residualRisk: body.residualRisk ?? "",
        scheduledCompletion: body.scheduledCompletion ? new Date(body.scheduledCompletion) : null,
        ownerId: body.ownerId || null,
        implementationId: body.implementationId || null,
        statusHistory: {
          create: { status: "OPEN", note: "POA&M created", changedBy: user.id },
        },
      },
    });

    await writeAuditEvent({
      actorId: user.id,
      action: "poam.create",
      entityType: "poam",
      entityId: poam.id,
      metadata: { poamNumber: poam.poamNumber, severity: poam.severity },
    });

    return poam;
  });
}
