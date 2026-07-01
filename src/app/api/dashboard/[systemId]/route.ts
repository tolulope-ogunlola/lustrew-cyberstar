import { prisma } from "@/lib/db";
import { HttpError, requireUser, route, requireSystemAccess } from "@/lib/api";
import { computeScore, type ImplForScore } from "@/lib/scoring";
import { parseFrameworks } from "@/lib/util";
import { isOpenRisk, score as riskScore } from "@/lib/risk";

// Per-system continuous-monitoring snapshot: scores + the lists the dashboard surfaces.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ systemId: string }> }
) {
  return route(async () => {
    const user = await requireUser();
    const { systemId } = await params;
    await requireSystemAccess(user, systemId);

    const system = await prisma.system.findFirst({
      where: { id: systemId, orgId: user.orgId },
    });
    if (!system) throw new HttpError(404, "System not found");

    const [impls, steps, poams, openVulns, allRisks] = await Promise.all([
      prisma.controlImplementation.findMany({
        where: { systemId },
        select: {
          status: true,
          scoping: true,
          narrative: true,
          _count: { select: { evidenceLinks: true } },
        },
      }),
      prisma.rmfStep.findMany({ where: { systemId }, select: { step: true, status: true } }),
      prisma.poam.findMany({
        where: { systemId },
        select: { status: true, scheduledCompletion: true, actualCompletion: true },
      }),
      prisma.vulnerability.findMany({
        where: { systemId, state: "OPEN" },
        select: { severity: true },
      }),
      prisma.risk.findMany({
        where: { systemId },
        select: { status: true, likelihood: true, impact: true },
      }),
    ]);

    const vulns = {
      open: openVulns.length,
      critical: openVulns.filter((v) => v.severity === "CRITICAL").length,
      high: openVulns.filter((v) => v.severity === "HIGH").length,
    };

    const openRiskRows = allRisks.filter((r) => isOpenRisk(r.status));
    const risks = {
      open: openRiskRows.length,
      highOrCritical: openRiskRows.filter((r) => {
        const rating = riskScore(r.likelihood, r.impact).rating;
        return rating === "HIGH" || rating === "CRITICAL";
      }).length,
    };

    const forScore: ImplForScore[] = impls.map((i) => ({
      status: i.status,
      scoping: i.scoping,
      narrative: i.narrative,
      _evidenceCount: i._count.evidenceLinks,
    }));

    const score = computeScore(forScore, steps, poams);

    // Controls due for review = applicable but not implemented/risk-accepted.
    const needsAttention = forScore.filter(
      (i) => i.scoping !== "NOT_APPLICABLE" && i.status !== "IMPLEMENTED" && i.status !== "RISK_ACCEPTED"
    ).length;

    // Missing evidence = applicable implemented/partial controls without a linked artifact.
    const missingEvidence = forScore.filter(
      (i) =>
        i.scoping !== "NOT_APPLICABLE" &&
        (i.status === "IMPLEMENTED" || i.status === "PARTIALLY_IMPLEMENTED") &&
        i._evidenceCount === 0
    ).length;

    return {
      system: { id: system.id, name: system.name, fipsCategory: system.fipsCategory, frameworks: parseFrameworks(system.frameworks) },
      score,
      needsAttention,
      missingEvidence,
      vulns,
      risks,
      rmf: steps,
    };
  });
}
