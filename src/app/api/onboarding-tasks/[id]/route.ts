import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { onboardingTaskUpdateSchema } from "@/lib/validation";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "personnel");
    const { id } = await params;
    const body = onboardingTaskUpdateSchema.parse(await req.json());

    const existing = await prisma.onboardingTask.findFirst({
      where: { id, personnel: { orgId: user.orgId } },
      select: { id: true, done: true, personnelId: true },
    });
    if (!existing) throw new HttpError(404, "Task not found");

    const completing = body.done === true && !existing.done;
    const updated = await prisma.onboardingTask.update({
      where: { id },
      data: {
        done: body.done,
        title: body.title,
        dueDate: body.dueDate === undefined ? undefined : body.dueDate ? new Date(body.dueDate) : null,
        sortOrder: body.sortOrder,
        completedAt: body.done === undefined ? undefined : completing ? new Date() : body.done === false ? null : undefined,
      },
    });
    await writeAuditEvent({ actorId: user.id, action: "personnel.task.update", entityType: "personnel", entityId: existing.personnelId, metadata: { taskId: id, done: updated.done } });
    return updated;
  });
}
