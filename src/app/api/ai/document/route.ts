import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { aiDocSchema } from "@/lib/validation";
import { loadSystemDossier } from "@/lib/ai/dossier";
import { generateDocument } from "@/lib/ai/copilot";

// POST /api/ai/document — generate a draft SSP or SAR (markdown) from the system dossier.
export async function POST(req: Request) {
  return route(async () => {
    const user = await requirePermission("read", "ai");
    const body = aiDocSchema.parse(await req.json());

    const dossier = await loadSystemDossier(body.systemId, user.orgId);
    if (!dossier) throw new HttpError(404, "System not found");

    const doc = await generateDocument(dossier, body.kind);

    await writeAuditEvent({
      actorId: user.id,
      action: "ai.document",
      entityType: "ai",
      entityId: body.systemId,
      metadata: { kind: body.kind, source: doc.source },
    });

    return doc;
  });
}
