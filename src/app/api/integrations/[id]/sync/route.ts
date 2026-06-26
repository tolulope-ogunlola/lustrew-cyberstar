import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { SCANNERS } from "@/lib/integrations/scanners";
import { ingestVulnerabilities } from "@/lib/vuln/ingest";
import { decryptConfig } from "@/lib/integrations/mask";

// Pull findings from a scanner connector and feed them through the shared vuln ingest pipeline.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "integration");
    const { id } = await params;
    const row = await prisma.integration.findFirst({ where: { id, orgId: user.orgId } });
    if (!row) throw new HttpError(404, "Integration not found");

    const scanner = SCANNERS[row.type];
    if (!scanner) throw new HttpError(400, "This connector does not support sync");
    if (!row.systemId) throw new HttpError(400, "Set a target system on the integration first");

    const system = await prisma.system.findFirst({ where: { id: row.systemId, orgId: user.orgId }, select: { id: true } });
    if (!system) throw new HttpError(404, "Target system not found");

    const config = decryptConfig(row.config || "{}");
    const findings = await scanner.fetchFindings(config);
    const result = await ingestVulnerabilities(row.systemId, row.type, findings);

    await prisma.scanImport.create({
      data: { systemId: row.systemId, fileName: `${row.type} sync`, source: row.type, total: result.total, created: result.created, updated: result.updated, importedById: user.id },
    });
    await prisma.integration.update({
      where: { id },
      data: { lastSyncAt: new Date(), lastResult: `${result.total} findings (${result.created} new, ${result.updated} updated)` },
    });
    await writeAuditEvent({ actorId: user.id, action: "integration.sync", entityType: "integration", entityId: id, metadata: result });

    return result;
  });
}
