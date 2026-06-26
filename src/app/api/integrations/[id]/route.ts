import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { encryptConfig, maskConfig } from "@/lib/integrations/mask";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  enabled: z.boolean().optional(),
  systemId: z.string().nullable().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

const MASK = "••••••";

async function load(orgId: string, id: string) {
  const row = await prisma.integration.findFirst({ where: { id, orgId } });
  if (!row) throw new HttpError(404, "Integration not found");
  return row;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "integration");
    const { id } = await params;
    const existing = await load(user.orgId, id);
    const body = updateSchema.parse(await req.json());

    let configJson: string | undefined;
    if (body.config) {
      // Merge over stored config; keep stored secrets when the client sends back the mask.
      const current: Record<string, unknown> = JSON.parse(existing.config || "{}");
      const merged = { ...current };
      for (const [k, v] of Object.entries(body.config)) {
        if (v === MASK) continue; // keep the stored (encrypted) secret when the client sends the mask
        merged[k] = v;
      }
      configJson = encryptConfig(merged); // re-encrypts any newly-provided plaintext secrets

    }

    const updated = await prisma.integration.update({
      where: { id },
      data: {
        name: body.name,
        enabled: body.enabled,
        systemId: body.systemId === undefined ? undefined : body.systemId,
        config: configJson,
      },
    });
    await writeAuditEvent({ actorId: user.id, action: "integration.update", entityType: "integration", entityId: id });
    return { ...updated, config: maskConfig(updated.config) };
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "integration");
    const { id } = await params;
    await load(user.orgId, id);
    await prisma.integration.delete({ where: { id } });
    await writeAuditEvent({ actorId: user.id, action: "integration.delete", entityType: "integration", entityId: id });
    return { ok: true };
  });
}
