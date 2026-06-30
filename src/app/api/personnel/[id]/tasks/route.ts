import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { onboardingTaskCreateSchema } from "@/lib/validation";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "personnel");
    const { id } = await params;
    const body = onboardingTaskCreateSchema.parse(await req.json());

    const person = await prisma.personnel.findFirst({ where: { id, orgId: user.orgId }, select: { id: true } });
    if (!person) throw new HttpError(404, "Personnel not found");

    const task = await prisma.onboardingTask.create({
      data: {
        personnelId: id,
        phase: body.phase,
        title: body.title,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        sortOrder: body.sortOrder ?? 0,
      },
    });
    await writeAuditEvent({ actorId: user.id, action: "personnel.task.create", entityType: "personnel", entityId: id, metadata: { taskId: task.id, phase: task.phase } });
    return task;
  });
}
