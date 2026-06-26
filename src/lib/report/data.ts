import { prisma } from "@/lib/db";
import { computeScore, type ImplForScore } from "@/lib/scoring";
import { assessRisk } from "@/lib/risk";

export type ReportColumn = { key: string; label: string; width?: number };
export type ReportRow = Record<string, string | number>;

export type ReportTable = {
  title: string;
  system: string;
  generatedAt: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  summary?: { label: string; value: string }[];
};

export const REPORT_TYPES = [
  "executive",
  "controls",
  "poam",
  "vulnerabilities",
  "risks",
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_META: Record<ReportType, { label: string; description: string }> = {
  executive: { label: "Executive Summary", description: "ATO readiness, posture, and key risk indicators" },
  controls: { label: "Control Implementation", description: "NIST 800-53 status, scoping, and evidence coverage" },
  poam: { label: "POA&M Report", description: "Open items, milestones, and aging" },
  vulnerabilities: { label: "Vulnerability Assessment", description: "Findings by severity with remediation priority" },
  risks: { label: "Risk Register", description: "Inherent and residual risk with treatment status" },
};

function fmtDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

async function systemName(systemId: string): Promise<string> {
  const s = await prisma.system.findUnique({ where: { id: systemId }, select: { name: true } });
  return s?.name ?? "Unknown system";
}

async function gatherControls(systemId: string): Promise<ReportTable> {
  const impls = await prisma.controlImplementation.findMany({
    where: { systemId },
    include: { control: true, owner: { select: { name: true } }, _count: { select: { evidenceLinks: true } } },
  });
  impls.sort((a, b) => a.control.controlId.localeCompare(b.control.controlId));
  return {
    title: "Control Implementation Report",
    system: await systemName(systemId),
    generatedAt: new Date().toISOString(),
    columns: [
      { key: "controlId", label: "Control", width: 12 },
      { key: "family", label: "Family", width: 8 },
      { key: "title", label: "Title", width: 40 },
      { key: "status", label: "Status", width: 22 },
      { key: "scoping", label: "Scoping", width: 16 },
      { key: "evidence", label: "Evidence", width: 10 },
      { key: "owner", label: "Owner", width: 18 },
    ],
    rows: impls.map((i) => ({
      controlId: i.control.controlId,
      family: i.control.family,
      title: i.control.title,
      status: i.status.replaceAll("_", " "),
      scoping: i.scoping.replaceAll("_", " "),
      evidence: i._count.evidenceLinks,
      owner: i.owner?.name ?? "",
    })),
  };
}

async function gatherPoam(systemId: string): Promise<ReportTable> {
  const poams = await prisma.poam.findMany({
    where: { systemId },
    orderBy: { createdAt: "desc" },
    include: { owner: { select: { name: true } }, implementation: { include: { control: { select: { controlId: true } } } } },
  });
  const now = Date.now();
  return {
    title: "Plan of Action & Milestones (POA&M) Report",
    system: await systemName(systemId),
    generatedAt: new Date().toISOString(),
    columns: [
      { key: "poamNumber", label: "POA&M", width: 14 },
      { key: "weaknessTitle", label: "Weakness", width: 40 },
      { key: "control", label: "Control", width: 10 },
      { key: "severity", label: "Severity", width: 12 },
      { key: "status", label: "Status", width: 16 },
      { key: "scheduled", label: "Scheduled", width: 14 },
      { key: "ageDays", label: "Age (d)", width: 10 },
      { key: "owner", label: "Owner", width: 18 },
    ],
    rows: poams.map((p) => ({
      poamNumber: p.poamNumber,
      weaknessTitle: p.weaknessTitle,
      control: p.implementation?.control.controlId ?? "",
      severity: p.severity,
      status: p.status.replaceAll("_", " "),
      scheduled: fmtDate(p.scheduledCompletion),
      ageDays: Math.floor((now - p.createdAt.getTime()) / 86_400_000),
      owner: p.owner?.name ?? "",
    })),
  };
}

async function gatherVulnerabilities(systemId: string): Promise<ReportTable> {
  const vulns = await prisma.vulnerability.findMany({
    where: { systemId },
    orderBy: [{ priorityScore: "desc" }],
  });
  return {
    title: "Vulnerability Assessment Report",
    system: await systemName(systemId),
    generatedAt: new Date().toISOString(),
    columns: [
      { key: "title", label: "Finding", width: 40 },
      { key: "severity", label: "Severity", width: 12 },
      { key: "cvss", label: "CVSS", width: 8 },
      { key: "priority", label: "Priority", width: 12 },
      { key: "host", label: "Host", width: 16 },
      { key: "cve", label: "CVE", width: 16 },
      { key: "control", label: "Control", width: 10 },
      { key: "state", label: "State", width: 16 },
      { key: "poam", label: "POA&M", width: 8 },
    ],
    rows: vulns.map((v) => ({
      title: v.title,
      severity: v.severity,
      cvss: v.cvss ?? "",
      priority: v.priority,
      host: v.host ?? "",
      cve: v.cve ?? "",
      control: v.mappedControl ?? "",
      state: v.state.replaceAll("_", " "),
      poam: v.poamId ? "Yes" : "",
    })),
  };
}

async function gatherRisks(systemId: string): Promise<ReportTable> {
  const risks = await prisma.risk.findMany({
    where: { systemId },
    orderBy: { createdAt: "desc" },
    include: { owner: { select: { name: true } } },
  });
  return {
    title: "Risk Register Report",
    system: await systemName(systemId),
    generatedAt: new Date().toISOString(),
    columns: [
      { key: "riskNumber", label: "Risk", width: 14 },
      { key: "title", label: "Title", width: 40 },
      { key: "inherent", label: "Inherent", width: 14 },
      { key: "residual", label: "Residual", width: 14 },
      { key: "status", label: "Status", width: 14 },
      { key: "target", label: "Target", width: 14 },
      { key: "authority", label: "Approval", width: 18 },
      { key: "owner", label: "Owner", width: 18 },
    ],
    rows: risks.map((r) => {
      const a = assessRisk(r);
      return {
        riskNumber: r.riskNumber,
        title: r.title,
        inherent: `${a.inherent.score} (${a.inherent.rating})`,
        residual: `${a.residual.score} (${a.residual.rating})`,
        status: r.status,
        target: fmtDate(r.targetDate),
        authority: r.approvalAuthority,
        owner: r.owner?.name ?? "",
      };
    }),
  };
}

async function gatherExecutive(systemId: string): Promise<ReportTable> {
  const [system, impls, steps, poams, openVulns, risks] = await Promise.all([
    prisma.system.findUnique({ where: { id: systemId }, select: { name: true, fipsCategory: true } }),
    prisma.controlImplementation.findMany({
      where: { systemId },
      select: { status: true, scoping: true, narrative: true, _count: { select: { evidenceLinks: true } } },
    }),
    prisma.rmfStep.findMany({ where: { systemId }, select: { status: true } }),
    prisma.poam.findMany({ where: { systemId }, select: { status: true, scheduledCompletion: true, actualCompletion: true } }),
    prisma.vulnerability.findMany({ where: { systemId, state: "OPEN" }, select: { severity: true } }),
    prisma.risk.findMany({ where: { systemId }, select: { status: true, likelihood: true, impact: true } }),
  ]);

  const forScore: ImplForScore[] = impls.map((i) => ({
    status: i.status,
    scoping: i.scoping,
    narrative: i.narrative,
    _evidenceCount: i._count.evidenceLinks,
  }));
  const score = computeScore(forScore, steps, poams);
  const critical = openVulns.filter((v) => v.severity === "CRITICAL").length;
  const high = openVulns.filter((v) => v.severity === "HIGH").length;
  const openRisks = risks.filter((r) => r.status === "OPEN" || r.status === "MITIGATING").length;

  return {
    title: "Executive Cybersecurity Posture Report",
    system: system?.name ?? "Unknown system",
    generatedAt: new Date().toISOString(),
    summary: [
      { label: "FIPS 199 categorization", value: system?.fipsCategory ?? "" },
      { label: "ATO readiness score", value: `${score.readinessScore} / 100` },
      { label: "Control posture", value: `${score.posturePercent}%` },
      { label: "RMF progress", value: `${score.rmfProgressPercent}%` },
      { label: "Evidence completeness", value: `${score.evidenceCompletePercent}%` },
      { label: "Applicable controls", value: `${score.controlsApplicable} of ${score.controlsTotal}` },
      { label: "Open POA&Ms", value: `${score.openPoams} (${score.overduePoams} overdue)` },
      { label: "Open vulnerabilities", value: `${openVulns.length} (${critical} critical, ${high} high)` },
      { label: "Open risks", value: `${openRisks}` },
    ],
    columns: [
      { key: "status", label: "Control status", width: 30 },
      { key: "count", label: "Count", width: 12 },
    ],
    rows: Object.entries(score.byStatus).map(([status, count]) => ({
      status: status.replaceAll("_", " "),
      count,
    })),
  };
}

export function gatherReport(type: ReportType, systemId: string): Promise<ReportTable> {
  switch (type) {
    case "controls":
      return gatherControls(systemId);
    case "poam":
      return gatherPoam(systemId);
    case "vulnerabilities":
      return gatherVulnerabilities(systemId);
    case "risks":
      return gatherRisks(systemId);
    case "executive":
      return gatherExecutive(systemId);
  }
}
