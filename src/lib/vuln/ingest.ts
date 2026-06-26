import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { assess } from "./prioritize";
import type { ParsedVuln } from "./parse";

export type IngestResult = {
  source: string;
  total: number;
  created: number;
  updated: number;
  bySeverity: Record<string, number>;
};

export function vulnDedupeKey(v: ParsedVuln): string {
  const basis = `${v.pluginId || v.title}|${v.host || ""}|${v.port || ""}|${v.cve || ""}`;
  return createHash("sha1").update(basis).digest("hex");
}

/**
 * Dedupe, prioritize, and upsert parsed findings for a system. Shared by the file-import route
 * and live scanner connectors (Tenable/Qualys) so every ingestion path behaves identically.
 */
export async function ingestVulnerabilities(
  systemId: string,
  source: string,
  findings: ParsedVuln[]
): Promise<IngestResult> {
  const byKey = new Map<string, ParsedVuln>();
  for (const f of findings) {
    const key = vulnDedupeKey(f);
    if (!byKey.has(key)) byKey.set(key, f);
  }

  const keys = [...byKey.keys()];
  const existing = await prisma.vulnerability.findMany({
    where: { systemId, dedupeKey: { in: keys } },
    select: { dedupeKey: true },
  });
  const existingKeys = new Set(existing.map((e) => e.dedupeKey));

  const now = new Date();
  let created = 0;
  let updated = 0;
  const bySeverity: Record<string, number> = {};

  for (const [key, f] of byKey) {
    const a = assess({ severity: f.severity, cvss: f.cvss, title: f.title, description: f.description, now });
    bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1;

    const common = {
      pluginId: f.pluginId ?? null,
      cve: f.cve ?? null,
      title: f.title.slice(0, 300),
      description: (f.description ?? "").slice(0, 8000),
      solution: (f.solution ?? "").slice(0, 8000),
      severity: a.severity,
      cvss: f.cvss ?? null,
      host: f.host ?? null,
      port: f.port ?? null,
      source,
      priority: a.priority,
      priorityScore: a.priorityScore,
      recommendation: a.recommendation,
      mappedControl: a.mappedControl,
      lastSeen: now,
    };

    if (existingKeys.has(key)) {
      await prisma.vulnerability.update({ where: { systemId_dedupeKey: { systemId, dedupeKey: key } }, data: common });
      updated++;
    } else {
      await prisma.vulnerability.create({ data: { systemId, dedupeKey: key, firstSeen: now, ...common } });
      created++;
    }
  }

  return { source, total: byKey.size, created, updated, bySeverity };
}
