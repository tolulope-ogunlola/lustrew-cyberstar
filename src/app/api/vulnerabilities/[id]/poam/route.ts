import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { slaDueDate, toPoamSeverity, type VulnSeverity } from "@/lib/vuln/prioritize";

async function nextPoamNumber(orgId: string): Promise<string> {
  const count = await prisma.poam.count({ where: { system: { orgId } } });
  return `POAM-${String(count + 1).padStart(4, "0")}`;
}

// POST -> create a POA&M from a vulnerability and link them.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return route(async () => {
    const user = await requirePermission("write", "poam");
    const { id } = await params;

    const vuln = await prisma.vulnerability.findFirst({
      where: { id, system: { orgId: user.orgId } },
    });
    if (!vuln) throw new HttpError(404, "Vulnerability not found");
    if (vuln.poamId) throw new HttpError(409, "Vulnerability is already linked to a POA&M");

    // Link to the mapped control's implementation on this system, if it exists.
    const impl = vuln.mappedControl
      ? await prisma.controlImplementation.findFirst({
          where: { systemId: vuln.systemId, control: { controlId: vuln.mappedControl } },
          select: { id: true },
        })
      : null;

    const severity = vuln.severity as VulnSeverity;
    const poamSeverity = toPoamSeverity(severity);
    const due = slaDueDate(severity);

    const descriptionParts = [
      vuln.description,
      vuln.host ? `Affected host: ${vuln.host}${vuln.port ? `:${vuln.port}` : ""}.` : "",
      vuln.cve ? `Reference: ${vuln.cve}.` : "",
      vuln.pluginId ? `Scanner plugin: ${vuln.pluginId}.` : "",
    ].filter(Boolean);

    const poam = await prisma.poam.create({
      data: {
        poamNumber: await nextPoamNumber(user.orgId),
        systemId: vuln.systemId,
        weaknessTitle: vuln.title.slice(0, 200),
        weaknessDescription: descriptionParts.join(" ").slice(0, 8000),
        source: "Vulnerability",
        severity: poamSeverity,
        riskRating: poamSeverity,
        cvss: vuln.cvss ?? null,
        status: "OPEN",
        remediationPlan: vuln.solution || "",
        scheduledCompletion: due,
        implementationId: impl?.id ?? null,
        statusHistory: {
          create: { status: "OPEN", note: `Converted from vulnerability ${vuln.pluginId ?? vuln.id}`, changedBy: user.id },
        },
      },
    });

    await prisma.vulnerability.update({ where: { id }, data: { poamId: poam.id } });

    await writeAuditEvent({
      actorId: user.id,
      action: "vuln.to_poam",
      entityType: "poam",
      entityId: poam.id,
      metadata: { poamNumber: poam.poamNumber, vulnId: id, control: vuln.mappedControl },
    });

    return { poamId: poam.id, poamNumber: poam.poamNumber, controlLinked: Boolean(impl) };
  });
}
