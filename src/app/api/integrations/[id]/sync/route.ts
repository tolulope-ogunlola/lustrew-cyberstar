import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { SCANNERS } from "@/lib/integrations/scanners";
import { REPOSITORIES } from "@/lib/integrations/sharepoint";
import { ingestVulnerabilities } from "@/lib/vuln/ingest";
import { ingestEvidenceDocs } from "@/lib/integrations/repoIngest";
import { REGISTRY } from "@/lib/integrations/registry";
import { decryptConfig } from "@/lib/integrations/mask";
import type { IntegrationType } from "@/lib/integrations/types";

// Pull data from a connector into the platform: scanner findings → vulnerabilities,
// repository documents → evidence vault.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "integration");
    const { id } = await params;
    const row = await prisma.integration.findFirst({ where: { id, orgId: user.orgId } });
    if (!row) throw new HttpError(404, "Integration not found");
    if (!REGISTRY[row.type as IntegrationType]?.capabilities.includes("SYNC")) throw new HttpError(400, "This connector does not support sync");
    if (!row.systemId) throw new HttpError(400, "Set a target system on the integration first");

    const system = await prisma.system.findFirst({ where: { id: row.systemId, orgId: user.orgId }, select: { id: true } });
    if (!system) throw new HttpError(404, "Target system not found");

    const config = decryptConfig(row.config || "{}");
    const scanner = SCANNERS[row.type];
    const repository = REPOSITORIES[row.type];

    let result: { total: number; created: number; updated: number };
    let summary: string;

    if (scanner) {
      const findings = await scanner.fetchFindings(config);
      const r = await ingestVulnerabilities(row.systemId, row.type, findings);
      result = r;
      summary = `${r.total} findings (${r.created} new, ${r.updated} updated)`;
      await prisma.scanImport.create({
        data: { systemId: row.systemId, fileName: `${row.type} sync`, source: row.type, total: r.total, created: r.created, updated: r.updated, importedById: user.id },
      });
    } else if (repository) {
      const docs = await repository.fetchDocuments(config);
      const r = await ingestEvidenceDocs(row.systemId, docs, user.id, REGISTRY[row.type as IntegrationType].label);
      result = { total: r.total, created: r.created, updated: r.skipped };
      summary = `${r.total} documents (${r.created} new evidence, ${r.skipped} already present)`;
    } else {
      throw new HttpError(400, "This connector does not support sync");
    }

    await prisma.integration.update({ where: { id }, data: { lastSyncAt: new Date(), lastResult: summary } });
    await writeAuditEvent({ actorId: user.id, action: "integration.sync", entityType: "integration", entityId: id, metadata: { type: row.type, ...result } });

    return { ...result, summary };
  });
}
