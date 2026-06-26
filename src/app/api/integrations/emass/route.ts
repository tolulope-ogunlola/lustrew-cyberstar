import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { writeAuditEvent } from "@/lib/audit";
import { buildEmassCsv } from "@/lib/integrations/emass";

// GET /api/integrations/emass?systemId=X -> eMASS-style POA&M CSV download.
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });
  if (!can(user.role, "read", "poam")) return Response.json({ error: "Forbidden" }, { status: 403 });

  const systemId = new URL(req.url).searchParams.get("systemId") || "";
  const system = await prisma.system.findFirst({ where: { id: systemId, orgId: user.orgId }, select: { id: true, name: true } });
  if (!system) return Response.json({ error: "System not found" }, { status: 404 });

  const poams = await prisma.poam.findMany({
    where: { systemId },
    orderBy: { createdAt: "desc" },
    include: { implementation: { include: { control: { select: { controlId: true } } } } },
  });

  const csv = buildEmassCsv(
    system.name,
    poams.map((p) => ({
      poamNumber: p.poamNumber,
      weaknessTitle: p.weaknessTitle,
      weaknessDescription: p.weaknessDescription,
      severity: p.severity,
      riskRating: p.riskRating,
      status: p.status,
      source: p.source,
      remediationPlan: p.remediationPlan,
      residualRisk: p.residualRisk,
      scheduledCompletion: p.scheduledCompletion,
      control: p.implementation?.control.controlId ?? null,
    }))
  );

  await writeAuditEvent({ actorId: user.id, action: "integration.emass_export", entityType: "system", entityId: systemId, metadata: { poams: poams.length } });

  const slug = system.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return new Response(new Uint8Array(csv), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-emass-poam-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
