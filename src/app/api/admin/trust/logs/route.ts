import { prisma } from "@/lib/db";
import { requireUser, route } from "@/lib/api";

export async function GET() {
  return route(async () => {
    const user = await requireUser();
    return prisma.accessLog.findMany({
      where: { orgId: user.orgId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  });
}
