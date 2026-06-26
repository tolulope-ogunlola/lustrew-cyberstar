import { prisma } from "@/lib/db";
import { HttpError, requireUser, route } from "@/lib/api";

// GET /api/metrics/history?systemId=X&days=30 -> chronological posture snapshots for trend charts.
export async function GET(req: Request) {
  return route(async () => {
    const user = await requireUser();
    const url = new URL(req.url);
    const systemId = url.searchParams.get("systemId");
    const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 30, 7), 180);
    if (!systemId) throw new HttpError(400, "systemId is required");

    const system = await prisma.system.findFirst({ where: { id: systemId, orgId: user.orgId }, select: { id: true } });
    if (!system) throw new HttpError(404, "System not found");

    const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
    const rows = await prisma.metricSnapshot.findMany({
      where: { systemId, day: { gte: since } },
      orderBy: { day: "asc" },
    });
    return rows;
  });
}
