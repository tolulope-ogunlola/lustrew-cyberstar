import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { writeAuditEvent } from "@/lib/audit";
import { runChecks } from "@/lib/checks/run";

// POST: run continuous-controls-monitoring checks.
//  - Scheduler → header `x-cron-secret: $CRON_SECRET` (no session) runs due checks for ALL orgs.
//  - Authenticated user with check-write → forces a run for their org (ignores frequency gating).
export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");

  if (cronSecret && provided && provided === cronSecret) {
    const orgs = await prisma.organization.findMany({ select: { id: true } });
    let ran = 0, passed = 0, failed = 0, errored = 0;
    for (const o of orgs) {
      const r = await runChecks(o.id, { due: true });
      ran += r.ran; passed += r.passed; failed += r.failed; errored += r.errored;
    }
    return Response.json({ scope: "all-orgs", orgs: orgs.length, ran, passed, failed, errored });
  }

  const user = await currentUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });
  if (!can(user.role, "write", "check")) return Response.json({ error: "Forbidden" }, { status: 403 });

  const result = await runChecks(user.orgId, { due: false });
  await writeAuditEvent({ actorId: user.id, action: "checks.run", entityType: "check", metadata: result });
  return Response.json({ scope: "org", ...result });
}
