import { prisma } from "@/lib/db";
import { requireUser, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { questionnaireCreateSchema } from "@/lib/validation";

export async function GET() {
  return route(async () => {
    const user = await requireUser();
    return prisma.questionnaire.findMany({
      where: { orgId: user.orgId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { items: true } } },
    });
  });
}

export async function POST(req: Request) {
  return route(async () => {
    const user = await requirePermission("write", "questionnaire");
    const body = questionnaireCreateSchema.parse(await req.json());
    const q = await prisma.questionnaire.create({
      data: { orgId: user.orgId, name: body.name, customer: body.customer ?? "", createdById: user.id },
    });
    await writeAuditEvent({ actorId: user.id, action: "questionnaire.create", entityType: "questionnaire", entityId: q.id, metadata: { name: q.name } });
    return q;
  });
}
