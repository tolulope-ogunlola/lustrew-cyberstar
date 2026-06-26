import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { aiDraftSchema } from "@/lib/validation";
import {
  draftControlNarrative,
  draftExecutiveSummary,
  draftPoamDescription,
  type DraftResult,
} from "@/lib/ai";
import { computeScore, type ImplForScore } from "@/lib/scoring";

export async function POST(req: Request) {
  return route(async () => {
    const user = await requirePermission("write", "ai");
    const body = aiDraftSchema.parse(await req.json());

    const system = await prisma.system.findFirst({
      where: { id: body.systemId, orgId: user.orgId },
    });
    if (!system) throw new HttpError(404, "System not found");

    let result: DraftResult;

    if (body.kind === "control_narrative") {
      if (!body.implementationId) throw new HttpError(400, "implementationId required");
      const impl = await prisma.controlImplementation.findFirst({
        where: { id: body.implementationId, systemId: system.id },
        include: {
          control: true,
          evidenceLinks: { include: { evidence: { select: { title: true } } } },
        },
      });
      if (!impl) throw new HttpError(404, "Implementation not found");
      result = await draftControlNarrative({
        systemName: system.name,
        fipsCategory: system.fipsCategory,
        controlId: impl.control.controlId,
        controlTitle: impl.control.title,
        controlText: impl.control.text,
        status: impl.status,
        evidenceTitles: impl.evidenceLinks.map((l) => l.evidence.title),
      });
    } else if (body.kind === "poam_description") {
      if (!body.poamId) throw new HttpError(400, "poamId required");
      const poam = await prisma.poam.findFirst({
        where: { id: body.poamId, systemId: system.id },
        include: { implementation: { include: { control: { select: { controlId: true } } } } },
      });
      if (!poam) throw new HttpError(404, "POA&M not found");
      result = await draftPoamDescription({
        weaknessTitle: poam.weaknessTitle,
        severity: poam.severity,
        source: poam.source,
        relatedControl: poam.implementation?.control.controlId ?? null,
        systemName: system.name,
      });
    } else {
      const [impls, steps, poams] = await Promise.all([
        prisma.controlImplementation.findMany({
          where: { systemId: system.id },
          select: { status: true, scoping: true, narrative: true, _count: { select: { evidenceLinks: true } } },
        }),
        prisma.rmfStep.findMany({ where: { systemId: system.id }, select: { status: true } }),
        prisma.poam.findMany({
          where: { systemId: system.id },
          select: { status: true, scheduledCompletion: true, actualCompletion: true },
        }),
      ]);
      const forScore: ImplForScore[] = impls.map((i) => ({
        status: i.status,
        scoping: i.scoping,
        narrative: i.narrative,
        _evidenceCount: i._count.evidenceLinks,
      }));
      const score = computeScore(forScore, steps, poams);
      result = await draftExecutiveSummary({
        systemName: system.name,
        readinessScore: score.readinessScore,
        posturePercent: score.posturePercent,
        openPoams: score.openPoams,
        overduePoams: score.overduePoams,
        rmfProgressPercent: score.rmfProgressPercent,
      });
    }

    await writeAuditEvent({
      actorId: user.id,
      action: "ai.draft",
      entityType: "ai",
      entityId: body.implementationId || body.poamId || system.id,
      metadata: { kind: body.kind, source: result.source },
    });

    return result;
  });
}
