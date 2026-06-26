import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { withFrameworks } from "@/lib/util";
import { aiPolicyAnalysisSchema } from "@/lib/validation";
import { analyzePolicy } from "@/lib/ai/policy-analysis";

// POST /api/ai/policy-analysis — map a pasted policy document to a system's controls and flag gaps.
export async function POST(req: Request) {
  return route(async () => {
    const user = await requirePermission("read", "ai");
    const body = aiPolicyAnalysisSchema.parse(await req.json());

    const system = await prisma.system.findFirst({ where: { id: body.systemId, orgId: user.orgId } });
    if (!system) throw new HttpError(404, "System not found");
    const sys = withFrameworks(system);

    const impls = await prisma.controlImplementation.findMany({
      where: { systemId: system.id, scoping: { not: "NOT_APPLICABLE" } },
      include: { control: { select: { controlId: true, title: true } } },
      orderBy: { control: { controlId: "asc" } },
    });

    const result = await analyzePolicy({
      systemName: system.name,
      frameworkLabel: sys.frameworks.join(", ") || "NIST 800-53",
      controls: impls.map((i) => ({ controlId: i.control.controlId, title: i.control.title })),
      policyText: body.text,
    });

    await writeAuditEvent({
      actorId: user.id,
      action: "ai.policy_analysis",
      entityType: "ai",
      entityId: system.id,
      metadata: { source: result.source, chars: body.text.length, controls: impls.length },
    });

    return result;
  });
}
