import { prisma } from "@/lib/db";
import { requireUser, route } from "@/lib/api";

export async function GET() {
  return route(async () => {
    const user = await requireUser();
    return prisma.accessRequest.findMany({
      where: { orgId: user.orgId },
      orderBy: { createdAt: "desc" },
      include: { nda: { select: { acceptedAt: true, acceptedName: true } }, _count: { select: { grants: true } } },
      take: 200,
    });
  });
}
