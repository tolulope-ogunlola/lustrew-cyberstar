import { prisma } from "@/lib/db";
import { computeScore, type ImplForScore } from "@/lib/scoring";
import { isOpenRisk, score as riskScore } from "@/lib/risk";
import { freshnessSummary } from "@/lib/evidence";

// Capture a daily posture snapshot per system so the dashboard can chart trends over time.
// Idempotent per (system, day) — safe to run repeatedly (e.g. from the notifications cron).
export async function recordSnapshots(orgId: string): Promise<number> {
  const systems = await prisma.system.findMany({ where: { orgId }, select: { id: true } });
  const day = new Date().toISOString().slice(0, 10);

  for (const sys of systems) {
    const [impls, steps, poams, openVulns, risks, evidence, checkAssignments] = await Promise.all([
      prisma.controlImplementation.findMany({
        where: { systemId: sys.id },
        select: { status: true, scoping: true, narrative: true, _count: { select: { evidenceLinks: true } } },
      }),
      prisma.rmfStep.findMany({ where: { systemId: sys.id }, select: { status: true } }),
      prisma.poam.findMany({ where: { systemId: sys.id }, select: { status: true, scheduledCompletion: true, actualCompletion: true } }),
      prisma.vulnerability.findMany({ where: { systemId: sys.id, state: "OPEN" }, select: { severity: true } }),
      prisma.risk.findMany({ where: { systemId: sys.id }, select: { status: true, likelihood: true, impact: true } }),
      prisma.evidence.findMany({ where: { systemId: sys.id }, select: { approvalStatus: true, validUntil: true, cadenceDays: true, collectedAt: true } }),
      prisma.checkAssignment.findMany({
        where: { systemId: sys.id, enabled: true },
        select: { results: { orderBy: { checkedAt: "desc" }, take: 1, select: { status: true } } },
      }),
    ]);

    const latestChecks = checkAssignments.map((a) => a.results[0]?.status).filter(Boolean);
    const checksPassing = latestChecks.filter((s) => s === "PASS").length;
    const checksFailing = latestChecks.filter((s) => s === "FAIL").length;

    const forScore: ImplForScore[] = impls.map((i) => ({
      status: i.status,
      scoping: i.scoping,
      narrative: i.narrative,
      _evidenceCount: i._count.evidenceLinks,
    }));
    const score = computeScore(forScore, steps, poams);
    const openRisks = risks.filter((r) => isOpenRisk(r.status) && ["HIGH", "CRITICAL"].includes(riskScore(r.likelihood, r.impact).rating)).length;

    const data = {
      orgId,
      readinessScore: score.readinessScore,
      posturePercent: score.posturePercent,
      rmfProgressPercent: score.rmfProgressPercent,
      evidenceCompletePercent: score.evidenceCompletePercent,
      evidenceFreshPercent: freshnessSummary(evidence).freshPercent,
      checksPassing,
      checksFailing,
      openPoams: score.openPoams,
      overduePoams: score.overduePoams,
      openVulnCritical: openVulns.filter((v) => v.severity === "CRITICAL").length,
      openVulnHigh: openVulns.filter((v) => v.severity === "HIGH").length,
      openRisks,
    };

    await prisma.metricSnapshot.upsert({
      where: { systemId_day: { systemId: sys.id, day } },
      create: { systemId: sys.id, day, ...data },
      update: data,
    });
  }
  return systems.length;
}
