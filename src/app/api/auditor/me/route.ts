import { prisma } from "@/lib/db";
import { requireUser, route } from "@/lib/api";

// The current external auditor's active engagements (system + scopes + expiry). Internal users
// get an empty list.
export async function GET() {
  return route(async () => {
    const user = await requireUser();
    if (!user.isExternal) return { engagements: [] };
    const now = new Date();
    const engagements = await prisma.auditEngagement.findMany({
      where: { auditorId: user.id, orgId: user.orgId, status: "ACTIVE", expiresAt: { gt: now } },
      include: { system: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return {
      engagements: engagements.map((e) => ({
        id: e.id,
        systemId: e.systemId,
        systemName: e.system.name,
        title: e.title,
        scopes: JSON.parse(e.scopes || "[]") as string[],
        expiresAt: e.expiresAt,
      })),
    };
  });
}
