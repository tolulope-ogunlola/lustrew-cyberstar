import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { aiGapSchema } from "@/lib/validation";
import { loadSystemDossier } from "@/lib/ai/dossier";
import { gapAnalysis } from "@/lib/ai/copilot";

// POST /api/ai/gap-analysis — deterministic gap detection + an AI-prioritized path to ATO.
export async function POST(req: Request) {
  return route(async () => {
    const user = await requirePermission("read", "ai");
    const body = aiGapSchema.parse(await req.json());

    const dossier = await loadSystemDossier(body.systemId, user.orgId);
    if (!dossier) throw new HttpError(404, "System not found");

    const { gaps, narrative } = await gapAnalysis(dossier);

    await writeAuditEvent({
      actorId: user.id,
      action: "ai.gap_analysis",
      entityType: "ai",
      entityId: body.systemId,
      metadata: { gaps: gaps.length, source: narrative.source },
    });

    return { score: dossier.score, gaps, narrative };
  });
}
