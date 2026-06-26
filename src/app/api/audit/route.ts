import { prisma } from "@/lib/db";
import { HttpError, requireUser, route } from "@/lib/api";
import { paginated, parsePage } from "@/lib/pagination";

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

// Admin-only audit feed (append-only, paginated).
export async function GET(req: Request) {
  return route(async () => {
    const user = await requireUser();
    if (user.role !== "ADMIN") throw new HttpError(403, "Audit log is admin-only");
    const p = parsePage(new URL(req.url), 50);

    const [events, total] = await Promise.all([
      prisma.auditEvent.findMany({
        orderBy: { createdAt: "desc" },
        skip: p.skip,
        take: p.take,
        include: { actor: { select: { name: true, role: true } } },
      }),
      prisma.auditEvent.count(),
    ]);

    // metadata is stored as a JSON string; parse it back for the client.
    const items = events.map((e) => ({ ...e, metadata: e.metadata ? safeParse(e.metadata) : null }));
    return paginated(items, total, p);
  });
}
