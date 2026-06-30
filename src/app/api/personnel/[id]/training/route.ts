import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { trainingAssignmentCreateSchema } from "@/lib/validation";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "personnel");
    const { id } = await params;
    const body = trainingAssignmentCreateSchema.parse(await req.json());

    const person = await prisma.personnel.findFirst({ where: { id, orgId: user.orgId }, select: { id: true } });
    if (!person) throw new HttpError(404, "Personnel not found");
    const course = await prisma.trainingCourse.findFirst({ where: { id: body.courseId, orgId: user.orgId }, select: { id: true } });
    if (!course) throw new HttpError(404, "Course not found");

    const assignment = await prisma.trainingAssignment.create({
      data: { personnelId: id, courseId: body.courseId, dueDate: body.dueDate ? new Date(body.dueDate) : null },
    });
    await writeAuditEvent({ actorId: user.id, action: "personnel.training.assign", entityType: "personnel", entityId: id, metadata: { assignmentId: assignment.id, courseId: body.courseId } });
    return assignment;
  });
}
