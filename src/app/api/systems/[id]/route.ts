import { prisma } from "@/lib/db";
import { HttpError, requireUser, route } from "@/lib/api";
import { withFrameworks } from "@/lib/util";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return route(async () => {
    const user = await requireUser();
    const { id } = await params;
    const system = await prisma.system.findFirst({
      where: { id, orgId: user.orgId },
      include: { owner: { select: { name: true } } },
    });
    if (!system) throw new HttpError(404, "System not found");
    return withFrameworks(system);
  });
}
