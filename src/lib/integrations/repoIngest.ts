import { prisma } from "@/lib/db";
import type { RepoDoc } from "./types";

export type RepoIngestResult = { total: number; created: number; skipped: number };

// Register repository documents as evidence (link-mode). Idempotent: an existing evidence row
// for the same system + URL is left untouched so re-syncs don't duplicate.
export async function ingestEvidenceDocs(systemId: string, docs: RepoDoc[], uploadedById: string, source = "SharePoint"): Promise<RepoIngestResult> {
  let created = 0;
  let skipped = 0;
  for (const d of docs) {
    if (!d.url) {
      skipped++;
      continue;
    }
    const existing = await prisma.evidence.findFirst({ where: { systemId, url: d.url }, select: { id: true } });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.evidence.create({
      data: {
        systemId,
        title: d.name,
        type: "Document",
        url: d.url,
        note: `Imported from ${source}${d.modifiedAt ? ` · modified ${d.modifiedAt.slice(0, 10)}` : ""}`,
        contentType: d.contentType ?? null,
        fileSize: typeof d.size === "number" ? d.size : null,
        uploadedById,
      },
    });
    created++;
  }
  return { total: docs.length, created, skipped };
}
