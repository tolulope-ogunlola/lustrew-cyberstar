import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { aiChatSchema } from "@/lib/validation";
import { loadSystemDossier } from "@/lib/ai/dossier";
import { copilotAnswer } from "@/lib/ai/copilot";

// POST /api/ai/chat — grounded Q&A about one system, answered only from its dossier.
export async function POST(req: Request) {
  return route(async () => {
    const user = await requirePermission("read", "ai");
    const body = aiChatSchema.parse(await req.json());

    const dossier = await loadSystemDossier(body.systemId, user.orgId);
    if (!dossier) throw new HttpError(404, "System not found");

    const result = await copilotAnswer(dossier, body.history ?? [], body.question);

    await writeAuditEvent({
      actorId: user.id,
      action: "ai.chat",
      entityType: "ai",
      entityId: body.systemId,
      metadata: { source: result.source },
    });

    return result;
  });
}
