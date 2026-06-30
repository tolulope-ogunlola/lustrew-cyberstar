import { prisma } from "@/lib/db";
import { requireUser, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { trainingCourseCreateSchema } from "@/lib/validation";

export async function GET() {
  return route(async () => {
    const user = await requireUser();
    return prisma.trainingCourse.findMany({
      where: { orgId: user.orgId },
      orderBy: { name: "asc" },
      include: { _count: { select: { assignments: true } } },
    });
  });
}

export async function POST(req: Request) {
  return route(async () => {
    const user = await requirePermission("write", "personnel");
    const body = trainingCourseCreateSchema.parse(await req.json());
    const course = await prisma.trainingCourse.create({
      data: {
        orgId: user.orgId,
        name: body.name,
        description: body.description ?? "",
        cadenceDays: body.cadenceDays ?? 365,
        active: body.active ?? true,
      },
    });
    await writeAuditEvent({ actorId: user.id, action: "training_course.create", entityType: "personnel", entityId: course.id, metadata: { name: course.name } });
    return course;
  });
}
