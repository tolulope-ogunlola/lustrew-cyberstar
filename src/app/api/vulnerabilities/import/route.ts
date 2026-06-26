import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { parseScan } from "@/lib/vuln/parse";
import { ingestVulnerabilities } from "@/lib/vuln/ingest";

const MAX_SCAN_BYTES = 30 * 1024 * 1024; // 30 MB

// POST multipart/form-data: systemId, file (.nessus | .csv)
export async function POST(req: Request) {
  return route(async () => {
    const user = await requirePermission("write", "vuln");

    const form = await req.formData();
    const systemId = String(form.get("systemId") || "");
    const file = form.get("file");
    if (!systemId) throw new HttpError(400, "systemId is required");
    if (!(file instanceof File)) throw new HttpError(400, "file is required");
    if (file.size > MAX_SCAN_BYTES) {
      throw new HttpError(413, `Scan exceeds ${Math.round(MAX_SCAN_BYTES / 1024 / 1024)} MB limit`);
    }

    const system = await prisma.system.findFirst({
      where: { id: systemId, orgId: user.orgId },
      select: { id: true },
    });
    if (!system) throw new HttpError(404, "System not found");

    let parsed;
    try {
      parsed = parseScan(file.name, await file.text());
    } catch (e) {
      throw new HttpError(422, e instanceof Error ? e.message : "Could not parse scan file");
    }

    const result = await ingestVulnerabilities(systemId, parsed.source, parsed.findings);

    await prisma.scanImport.create({
      data: {
        systemId,
        fileName: file.name,
        source: parsed.source,
        total: result.total,
        created: result.created,
        updated: result.updated,
        importedById: user.id,
      },
    });

    await writeAuditEvent({
      actorId: user.id,
      action: "vuln.import",
      entityType: "scanImport",
      entityId: systemId,
      metadata: { fileName: file.name, source: parsed.source, total: result.total, created: result.created, updated: result.updated },
    });

    return result;
  });
}
