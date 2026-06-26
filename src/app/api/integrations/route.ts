import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { REGISTRY } from "@/lib/integrations/registry";
import { encryptConfig, maskConfig } from "@/lib/integrations/mask";
import type { IntegrationType } from "@/lib/integrations/types";
import { z } from "zod";

export async function GET() {
  return route(async () => {
    const user = await requirePermission("read", "integration");
    const rows = await prisma.integration.findMany({ where: { orgId: user.orgId }, orderBy: { createdAt: "asc" } });
    return rows.map((r) => ({ ...r, config: maskConfig(r.config) }));
  });
}

const createSchema = z.object({
  type: z.enum(["TENABLE", "QUALYS", "SERVICENOW", "SHAREPOINT", "EMASS"]),
  name: z.string().min(2).max(120),
  config: z.record(z.string(), z.unknown()).optional().default({}),
  systemId: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  return route(async () => {
    const user = await requirePermission("write", "integration");
    const body = createSchema.parse(await req.json());
    if (!REGISTRY[body.type as IntegrationType]) throw new HttpError(400, "Unknown integration type");

    const created = await prisma.integration.create({
      data: {
        orgId: user.orgId,
        type: body.type,
        name: body.name,
        config: encryptConfig(body.config ?? {}),
        systemId: body.systemId || null,
      },
    });
    await writeAuditEvent({ actorId: user.id, action: "integration.create", entityType: "integration", entityId: created.id, metadata: { type: body.type } });
    return { ...created, config: maskConfig(created.config) };
  });
}
