import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { trainingCourseUpdateSchema } from "@/lib/validation";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "personnel");
    const { id } = await params;
    const body = trainingCourseUpdateSchema.parse(await req.json());
    const existing = await prisma.trainingCourse.findFirst({ where: { id, orgId: user.orgId }, select: { id: true } });
    if (!existing) throw new HttpError(404, "Course not found");
    const updated = await prisma.trainingCourse.update({
      where: { id },
      data: { name: body.name, description: body.description, cadenceDays: body.cadenceDays, active: body.active },
    });
    await writeAuditEvent({ actorId: user.id, action: "training_course.update", entityType: "personnel", entityId: id, metadata: { name: updated.name } });
    return updated;
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "personnel");
    const { id } = await params;
    const existing = await prisma.trainingCourse.findFirst({ where: { id, orgId: user.orgId }, select: { id: true, name: true } });
    if (!existing) throw new HttpError(404, "Course not found");
    await prisma.trainingCourse.delete({ where: { id } });
    await writeAuditEvent({ actorId: user.id, action: "training_course.delete", entityType: "personnel", entityId: id, metadata: { name: existing.name } });
    return { ok: true };
  });
}
