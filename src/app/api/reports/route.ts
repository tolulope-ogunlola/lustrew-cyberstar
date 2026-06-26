import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { can, type Entity } from "@/lib/rbac";
import { writeAuditEvent } from "@/lib/audit";
import { gatherReport, REPORT_TYPES, type ReportType } from "@/lib/report/data";
import { FORMAT_META, renderReport, type ReportFormat } from "@/lib/report/format";

// Which read permission each report requires.
const REPORT_ENTITY: Record<ReportType, Entity> = {
  executive: "system",
  conmon: "system",
  controls: "control",
  poam: "poam",
  vulnerabilities: "vuln",
  risks: "risk",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// GET /api/reports?type=executive&systemId=X&format=pdf
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return json(401, { error: "Not authenticated" });

  const url = new URL(req.url);
  const type = url.searchParams.get("type") as ReportType | null;
  const systemId = url.searchParams.get("systemId") || "";
  const format = (url.searchParams.get("format") || "pdf") as ReportFormat;

  if (!type || !REPORT_TYPES.includes(type)) return json(400, { error: "Unknown report type" });
  if (!(format in FORMAT_META)) return json(400, { error: "Unknown format" });
  if (!systemId) return json(400, { error: "systemId is required" });

  if (!can(user.role, "read", REPORT_ENTITY[type])) {
    return json(403, { error: `Role ${user.role} cannot read ${type} reports` });
  }

  const system = await prisma.system.findFirst({
    where: { id: systemId, orgId: user.orgId },
    select: { id: true, name: true },
  });
  if (!system) return json(404, { error: "System not found" });

  let buffer: Buffer;
  try {
    const report = await gatherReport(type, systemId);
    buffer = await renderReport(report, format);
  } catch (e) {
    console.error("report generation failed", e);
    return json(500, { error: "Report generation failed" });
  }

  await writeAuditEvent({
    actorId: user.id,
    action: "report.export",
    entityType: "report",
    entityId: systemId,
    metadata: { type, format, bytes: buffer.length },
  });

  const slug = system.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const meta = FORMAT_META[format];
  const filename = `${slug}-${type}-${new Date().toISOString().slice(0, 10)}.${meta.ext}`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": meta.contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, no-store",
    },
  });
}
