import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { mapStigControl, parseCkl, type ParsedStig } from "@/lib/stig/parse";

const MAX_BYTES = 30 * 1024 * 1024;

function dedupeKey(s: ParsedStig): string {
  return createHash("sha1").update(`${s.vulnNum}|${s.host || ""}|${s.stigName || ""}`).digest("hex");
}

// POST multipart/form-data: systemId, file (.ckl)
export async function POST(req: Request) {
  return route(async () => {
    const user = await requirePermission("write", "stig");
    const form = await req.formData();
    const systemId = String(form.get("systemId") || "");
    const file = form.get("file");
    if (!systemId) throw new HttpError(400, "systemId is required");
    if (!(file instanceof File)) throw new HttpError(400, "file is required");
    if (file.size > MAX_BYTES) throw new HttpError(413, "Checklist exceeds size limit");

    const system = await prisma.system.findFirst({ where: { id: systemId, orgId: user.orgId }, select: { id: true } });
    if (!system) throw new HttpError(404, "System not found");

    let findings: ParsedStig[];
    try {
      findings = parseCkl(await file.text());
    } catch (e) {
      throw new HttpError(422, e instanceof Error ? e.message : "Could not parse checklist");
    }

    const byKey = new Map<string, ParsedStig>();
    for (const f of findings) byKey.set(dedupeKey(f), f);

    const keys = [...byKey.keys()];
    const existing = await prisma.stigFinding.findMany({
      where: { systemId, dedupeKey: { in: keys } },
      select: { dedupeKey: true },
    });
    const existingKeys = new Set(existing.map((e) => e.dedupeKey));

    const now = new Date();
    let created = 0;
    let updated = 0;
    const bySeverity: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    for (const [key, f] of byKey) {
      bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
      byStatus[f.status] = (byStatus[f.status] || 0) + 1;
      const common = {
        vulnNum: f.vulnNum,
        ruleId: f.ruleId ?? null,
        ruleTitle: f.ruleTitle.slice(0, 400),
        groupTitle: f.groupTitle ?? "",
        severity: f.severity,
        status: f.status,
        findingDetails: (f.findingDetails ?? "").slice(0, 8000),
        comments: (f.comments ?? "").slice(0, 8000),
        cci: f.cci ?? "",
        host: f.host ?? null,
        stigName: f.stigName ?? "",
        mappedControl: mapStigControl(),
        lastSeen: now,
      };
      if (existingKeys.has(key)) {
        await prisma.stigFinding.update({ where: { systemId_dedupeKey: { systemId, dedupeKey: key } }, data: common });
        updated++;
      } else {
        await prisma.stigFinding.create({ data: { systemId, dedupeKey: key, firstSeen: now, ...common } });
        created++;
      }
    }

    await writeAuditEvent({
      actorId: user.id,
      action: "stig.import",
      entityType: "stigFinding",
      entityId: systemId,
      metadata: { fileName: file.name, total: byKey.size, created, updated },
    });

    return { total: byKey.size, created, updated, bySeverity, byStatus };
  });
}
