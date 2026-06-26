import { prisma } from "@/lib/db";
import { HttpError, requireUser, route } from "@/lib/api";

/**
 * GET /api/controls            -> global NIST 800-53 catalog
 * GET /api/controls?systemId=X -> that system's control implementations (joined with catalog)
 */
export async function GET(req: Request) {
  return route(async () => {
    const user = await requireUser();
    const systemId = new URL(req.url).searchParams.get("systemId");

    if (!systemId) {
      return prisma.control.findMany({ orderBy: { controlId: "asc" } });
    }

    const system = await prisma.system.findFirst({
      where: { id: systemId, orgId: user.orgId },
      select: { id: true },
    });
    if (!system) throw new HttpError(404, "System not found");

    const impls = await prisma.controlImplementation.findMany({
      where: { systemId },
      include: {
        control: true,
        owner: { select: { name: true } },
        _count: { select: { evidenceLinks: true } },
      },
    });
    impls.sort((a, b) => a.control.controlId.localeCompare(b.control.controlId));
    return impls;
  });
}
