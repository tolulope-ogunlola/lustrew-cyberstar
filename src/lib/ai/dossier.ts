import { prisma } from "@/lib/db";
import { computeScore, type ImplForScore } from "@/lib/scoring";
import { isOpenRisk, score as riskScore } from "@/lib/risk";

// A structured, org-scoped snapshot of everything the AI Copilot reasons over for one system.
// Shared by grounded chat, gap analysis, and SSP/SAR document generation so they stay consistent.
export type DossierControl = {
  controlId: string;
  family: string;
  title: string;
  text: string;
  status: string;
  scoping: string;
  narrative: string;
  evidenceCount: number;
};

export type SystemDossier = {
  system: { id: string; name: string; description: string; fipsCategory: string; frameworks: string[] };
  score: ReturnType<typeof computeScore>;
  controls: DossierControl[];
  rmf: { step: string; status: string }[];
  poams: { poamNumber: string; title: string; severity: string; status: string; scheduled: string | null; overdue: boolean }[];
  vulns: { title: string; severity: string; cve: string | null }[];
  risks: { title: string; status: string; rating: string }[];
  policies: { title: string; status: string; framework: string }[];
};

export async function loadSystemDossier(systemId: string, orgId: string): Promise<SystemDossier | null> {
  const system = await prisma.system.findFirst({ where: { id: systemId, orgId } });
  if (!system) return null;

  const [impls, steps, poams, vulns, risks, policies] = await Promise.all([
    prisma.controlImplementation.findMany({
      where: { systemId },
      include: { control: true, _count: { select: { evidenceLinks: true } } },
      orderBy: { control: { controlId: "asc" } },
    }),
    prisma.rmfStep.findMany({ where: { systemId }, select: { step: true, status: true } }),
    prisma.poam.findMany({ where: { systemId }, orderBy: { createdAt: "desc" } }),
    prisma.vulnerability.findMany({ where: { systemId, state: "OPEN" }, orderBy: { severity: "asc" } }),
    prisma.risk.findMany({ where: { systemId } }),
    prisma.policy.findMany({ where: { orgId }, select: { title: true, status: true, framework: true } }),
  ]);

  const forScore: ImplForScore[] = impls.map((i) => ({
    status: i.status,
    scoping: i.scoping,
    narrative: i.narrative,
    _evidenceCount: i._count.evidenceLinks,
  }));
  const score = computeScore(forScore, steps, poams);
  const now = Date.now();

  return {
    system: {
      id: system.id,
      name: system.name,
      description: system.description,
      fipsCategory: system.fipsCategory,
      frameworks: safeParse(system.frameworks),
    },
    score,
    controls: impls.map((i) => ({
      controlId: i.control.controlId,
      family: i.control.family,
      title: i.control.title,
      text: i.control.text,
      status: i.status,
      scoping: i.scoping,
      narrative: i.narrative,
      evidenceCount: i._count.evidenceLinks,
    })),
    rmf: steps,
    poams: poams.map((p) => ({
      poamNumber: p.poamNumber,
      title: p.weaknessTitle,
      severity: p.severity,
      status: p.status,
      scheduled: p.scheduledCompletion ? p.scheduledCompletion.toISOString().slice(0, 10) : null,
      overdue:
        !!p.scheduledCompletion &&
        !p.actualCompletion &&
        !["COMPLETED", "CLOSED", "RISK_ACCEPTED"].includes(p.status) &&
        p.scheduledCompletion.getTime() < now,
    })),
    vulns: vulns.map((v) => ({ title: v.title, severity: v.severity, cve: v.cve ?? null })),
    risks: risks
      .filter((r) => isOpenRisk(r.status))
      .map((r) => ({ title: r.title, status: r.status, rating: riskScore(r.likelihood, r.impact).rating })),
    policies,
  };
}

function safeParse(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}
