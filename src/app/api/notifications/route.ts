import { prisma } from "@/lib/db";
import { requireUser, route } from "@/lib/api";

// Org notifications, unread first then most recent, plus the unread count for the topbar badge.
export async function GET(req: Request) {
  return route(async () => {
    const user = await requireUser();
    const unreadOnly = new URL(req.url).searchParams.get("unread") === "1";

    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { orgId: user.orgId, ...(unreadOnly ? { isRead: false } : {}) },
        orderBy: [{ isRead: "asc" }, { createdAt: "desc" }],
        take: 100,
      }),
      prisma.notification.count({ where: { orgId: user.orgId, isRead: false } }),
    ]);

    return { items, unreadCount };
  });
}
