import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { stigSlaDays, stigToPoamSeverity, type StigSeverity } from "@/lib/stig/parse";

async function nextPoamNumber(orgId: string): Promise<string> {
  const count = await prisma.poam.count({ where: { system: { orgId } } });
  return `POAM-${String(count + 1).padStart(4, "0")}`;
}

// POST -> create a POA&M from an open STIG finding and link them.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "poam");
    const { id } = await params;

    const finding = await prisma.stigFinding.findFirst({ where: { id, system: { orgId: user.orgId } } });
    if (!finding) throw new HttpError(404, "Finding not found");
    if (finding.poamId) throw new HttpError(409, "Finding is already linked to a POA&M");

    const impl = finding.mappedControl
      ? await prisma.controlImplementation.findFirst({
          where: { systemId: finding.systemId, control: { controlId: finding.mappedControl } },
          select: { id: true },
        })
      : null;

    const severity = finding.severity as StigSeverity;
    const due = new Date(Date.now() + stigSlaDays(severity) * 86_400_000);
    const descParts = [
      finding.ruleTitle,
      finding.host ? `Host: ${finding.host}.` : "",
      finding.cci ? `CCI: ${finding.cci}.` : "",
      `STIG check ${finding.vulnNum}${finding.stigName ? ` (${finding.stigName})` : ""}.`,
    ].filter(Boolean);

    const poam = await prisma.poam.create({
      data: {
        poamNumber: await nextPoamNumber(user.orgId),
        systemId: finding.systemId,
        weaknessTitle: `${finding.vulnNum}: ${finding.ruleTitle}`.slice(0, 200),
        weaknessDescription: descParts.join(" ").slice(0, 8000),
        source: "STIG",
        severity: stigToPoamSeverity(severity),
        riskRating: stigToPoamSeverity(severity),
        status: "OPEN",
        remediationPlan: finding.comments || "",
        scheduledCompletion: due,
        implementationId: impl?.id ?? null,
        statusHistory: { create: { status: "OPEN", note: `Converted from STIG ${finding.vulnNum}`, changedBy: user.id } },
      },
    });

    await prisma.stigFinding.update({ where: { id }, data: { poamId: poam.id } });

    await writeAuditEvent({
      actorId: user.id,
      action: "stig.to_poam",
      entityType: "poam",
      entityId: poam.id,
      metadata: { poamNumber: poam.poamNumber, vulnNum: finding.vulnNum },
    });

    return { poamId: poam.id, poamNumber: poam.poamNumber, controlLinked: Boolean(impl) };
  });
}
