import { prisma } from "@/lib/db";
import { requireUser, route } from "@/lib/api";

// GET /api/checks — the check catalog plus this org's assignments and their latest results.
export async function GET() {
  return route(async () => {
    const user = await requireUser();

    const [catalog, assignments, systems, integrations] = await Promise.all([
      prisma.check.findMany({ orderBy: { title: "asc" } }),
      prisma.checkAssignment.findMany({
        where: { orgId: user.orgId },
        include: {
          check: true,
          system: { select: { id: true, name: true } },
          results: { orderBy: { checkedAt: "desc" }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.system.findMany({ where: { orgId: user.orgId }, select: { id: true, name: true } }),
      prisma.integration.findMany({
        where: { orgId: user.orgId, type: { in: ["GITHUB", "M365", "GOOGLE_WS", "AWS", "OCI"] } },
        select: { id: true, type: true, name: true, enabled: true },
      }),
    ]);

    return {
      catalog,
      assignments: assignments.map((a) => ({
        id: a.id,
        systemId: a.systemId,
        systemName: a.system.name,
        enabled: a.enabled,
        check: { key: a.check.key, title: a.check.title, providerType: a.check.providerType, severity: a.check.severity, frequency: a.check.frequency, category: a.check.category },
        latest: a.results[0]
          ? { status: a.results[0].status, details: a.results[0].details, checkedAt: a.results[0].checkedAt, failingCount: a.results[0].failingCount }
          : null,
      })),
      systems,
      integrations,
    };
  });
}
