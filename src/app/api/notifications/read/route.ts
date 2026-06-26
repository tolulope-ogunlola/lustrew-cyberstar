import { prisma } from "@/lib/db";
import { requireUser, route } from "@/lib/api";
import { z } from "zod";

const schema = z.object({ id: z.string().optional(), all: z.boolean().optional() });

// Mark a single notification (or all of the org's) as read.
export async function POST(req: Request) {
  return route(async () => {
    const user = await requireUser();
    const { id, all } = schema.parse(await req.json());

    if (all) {
      const r = await prisma.notification.updateMany({
        where: { orgId: user.orgId, isRead: false },
        data: { isRead: true },
      });
      return { updated: r.count };
    }
    if (id) {
      await prisma.notification.updateMany({
        where: { id, orgId: user.orgId },
        data: { isRead: true },
      });
      return { updated: 1 };
    }
    return { updated: 0 };
  });
}
