import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { writeAuditEvent } from "@/lib/audit";
import { runNotifications } from "@/lib/notifications/run";

// POST: recompute notifications.
//  - Authenticated user → runs for their org.
//  - Scheduler → send header `x-cron-secret: $CRON_SECRET` (no session) to run for ALL orgs.
export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");

  if (cronSecret && provided && provided === cronSecret) {
    const orgs = await prisma.organization.findMany({ select: { id: true } });
    let totals = { created: 0, updated: 0, resolved: 0, total: 0 };
    for (const o of orgs) {
      const r = await runNotifications(o.id);
      totals = {
        created: totals.created + r.created,
        updated: totals.updated + r.updated,
        resolved: totals.resolved + r.resolved,
        total: totals.total + r.total,
      };
    }
    return Response.json({ scope: "all-orgs", orgs: orgs.length, ...totals });
  }

  const user = await currentUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const result = await runNotifications(user.orgId);
  await writeAuditEvent({
    actorId: user.id,
    action: "notifications.run",
    entityType: "notification",
    metadata: result,
  });
  return Response.json({ scope: "org", ...result });
}
