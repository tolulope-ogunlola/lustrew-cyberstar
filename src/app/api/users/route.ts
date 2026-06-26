import { prisma } from "@/lib/db";
import { requireUser, route } from "@/lib/api";

// Org users — used to populate owner/assignee dropdowns.
export async function GET() {
  return route(async () => {
    const user = await requireUser();
    return prisma.user.findMany({
      where: { orgId: user.orgId },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    });
  });
}
