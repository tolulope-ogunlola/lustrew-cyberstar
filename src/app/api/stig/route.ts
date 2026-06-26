import { prisma } from "@/lib/db";
import { HttpError, requireUser, route } from "@/lib/api";

const SEV_ORDER: Record<string, number> = { CAT_I: 0, CAT_II: 1, CAT_III: 2 };

// GET /api/stig?systemId=X -> checklist findings (open first, then by CAT severity)
export async function GET(req: Request) {
  return route(async () => {
    const user = await requireUser();
    const systemId = new URL(req.url).searchParams.get("systemId");
    if (!systemId) throw new HttpError(400, "systemId is required");

    const system = await prisma.system.findFirst({ where: { id: systemId, orgId: user.orgId }, select: { id: true } });
    if (!system) throw new HttpError(404, "System not found");

    const rows = await prisma.stigFinding.findMany({ where: { systemId } });
    rows.sort((a, b) => {
      const openA = a.status === "OPEN" ? 0 : 1;
      const openB = b.status === "OPEN" ? 0 : 1;
      if (openA !== openB) return openA - openB;
      return (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9);
    });
    return rows;
  });
}
