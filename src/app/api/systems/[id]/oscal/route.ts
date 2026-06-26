import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { writeAuditEvent } from "@/lib/audit";
import { buildOscalSsp, buildOscalAssessmentResults } from "@/lib/oscal-export";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// GET /api/systems/[id]/oscal?type=ssp|assessment[&assessmentId=]
// Returns an OSCAL JSON document (SSP from control implementations, or assessment-results from a SCA)
// as a downloadable attachment.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return json(401, { error: "Not authenticated" });

  const { id } = await params;
  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "ssp";

  const system = await prisma.system.findFirst({ where: { id, orgId: user.orgId } });
  if (!system) return json(404, { error: "System not found" });

  let doc: Record<string, unknown>;
  let filename: string;

  if (type === "assessment") {
    const assessmentId = url.searchParams.get("assessmentId");
    const assessment = assessmentId
      ? await prisma.assessment.findFirst({ where: { id: assessmentId, systemId: id }, include: { results: { orderBy: { controlId: "asc" } } } })
      : await prisma.assessment.findFirst({
          where: { systemId: id, status: "COMPLETED" },
          orderBy: { completedAt: "desc" },
          include: { results: { orderBy: { controlId: "asc" } } },
        });
    if (!assessment) return json(404, { error: "No assessment found to export" });
    doc = buildOscalAssessmentResults({
      assessmentId: assessment.id,
      title: assessment.title,
      systemName: system.name,
      assessorName: assessment.assessorName,
      startedAt: assessment.startedAt.toISOString(),
      completedAt: assessment.completedAt ? assessment.completedAt.toISOString() : null,
      results: assessment.results.map((r) => ({ controlId: r.controlId, result: r.result, findings: r.findings, recommendation: r.recommendation })),
    });
    filename = `oscal-assessment-results-${id}.json`;
  } else if (type === "ssp") {
    const impls = await prisma.controlImplementation.findMany({
      where: { systemId: id },
      include: { control: { select: { controlId: true } } },
      orderBy: { control: { controlId: "asc" } },
    });
    doc = buildOscalSsp({
      systemId: system.id,
      systemName: system.name,
      description: system.description,
      fipsCategory: system.fipsCategory,
      controls: impls.map((i) => ({
        controlId: i.control.controlId,
        status: i.status,
        scoping: i.scoping,
        narrative: i.narrative,
        providerName: i.providerName,
      })),
    });
    filename = `oscal-ssp-${id}.json`;
  } else {
    return json(400, { error: "Unknown OSCAL export type (use ssp or assessment)" });
  }

  await writeAuditEvent({ actorId: user.id, action: "oscal.export", entityType: "system", entityId: id, metadata: { type } });

  return new Response(JSON.stringify(doc, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
