import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { pushPoamToServiceNow } from "@/lib/integrations/servicenow";
import { decryptConfig } from "@/lib/integrations/mask";
import { z } from "zod";

const schema = z.object({ poamId: z.string() });

// Push a POA&M to ServiceNow (mock mode returns a synthetic incident number).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "integration");
    const { id } = await params;
    const { poamId } = schema.parse(await req.json());

    const row = await prisma.integration.findFirst({ where: { id, orgId: user.orgId } });
    if (!row) throw new HttpError(404, "Integration not found");
    if (row.type !== "SERVICENOW") throw new HttpError(400, "This connector does not support push");

    const poam = await prisma.poam.findFirst({ where: { id: poamId, system: { orgId: user.orgId } } });
    if (!poam) throw new HttpError(404, "POA&M not found");

    const config = decryptConfig(row.config || "{}");
    const result = await pushPoamToServiceNow(config, {
      poamNumber: poam.poamNumber,
      weaknessTitle: poam.weaknessTitle,
      weaknessDescription: poam.weaknessDescription,
      severity: poam.severity,
    });
    if (!result.ok) throw new HttpError(502, result.message);

    await prisma.integration.update({ where: { id }, data: { lastSyncAt: new Date(), lastResult: result.message } });
    await writeAuditEvent({ actorId: user.id, action: "integration.push", entityType: "poam", entityId: poamId, metadata: { ref: result.ref } });
    return result;
  });
}
