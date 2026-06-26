import { prisma } from "@/lib/db";
import { HttpError, requireUser, route } from "@/lib/api";

// GET /api/vulnerabilities?systemId=X -> findings for a system, highest priority first.
export async function GET(req: Request) {
  return route(async () => {
    const user = await requireUser();
    const systemId = new URL(req.url).searchParams.get("systemId");
    if (!systemId) throw new HttpError(400, "systemId is required");

    const system = await prisma.system.findFirst({
      where: { id: systemId, orgId: user.orgId },
      select: { id: true },
    });
    if (!system) throw new HttpError(404, "System not found");

    return prisma.vulnerability.findMany({
      where: { systemId },
      orderBy: [{ priorityScore: "desc" }, { lastSeen: "desc" }],
    });
  });
}
