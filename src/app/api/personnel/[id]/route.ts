import { prisma } from "@/lib/db";
import { HttpError, requireUser, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { personnelUpdateSchema } from "@/lib/validation";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requireUser();
    const { id } = await params;
    const person = await prisma.personnel.findFirst({
      where: { id, orgId: user.orgId },
      include: {
        user: { select: { id: true, email: true, mfaEnabled: true } },
        trainingAssignments: { orderBy: { assignedAt: "desc" }, include: { course: { select: { name: true, cadenceDays: true } } } },
        accessReviews: { orderBy: { createdAt: "desc" } },
        onboardingTasks: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!person) throw new HttpError(404, "Personnel not found");
    return person;
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "personnel");
    const { id } = await params;
    const body = personnelUpdateSchema.parse(await req.json());
    const existing = await prisma.personnel.findFirst({ where: { id, orgId: user.orgId }, select: { id: true } });
    if (!existing) throw new HttpError(404, "Personnel not found");

    if (body.userId) {
      const u = await prisma.user.findFirst({ where: { id: body.userId, orgId: user.orgId }, select: { id: true } });
      if (!u) throw new HttpError(404, "User not found in your organization");
      const taken = await prisma.personnel.findUnique({ where: { userId: body.userId }, select: { id: true } });
      if (taken && taken.id !== id) throw new HttpError(409, "That user is already linked to another personnel record");
    }

    const updated = await prisma.personnel.update({
      where: { id },
      data: {
        fullName: body.fullName,
        email: body.email,
        personnelType: body.personnelType,
        department: body.department,
        jobTitle: body.jobTitle,
        status: body.status,
        startDate: body.startDate === undefined ? undefined : body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate === undefined ? undefined : body.endDate ? new Date(body.endDate) : null,
        bgCheckStatus: body.bgCheckStatus,
        bgCheckDate: body.bgCheckDate === undefined ? undefined : body.bgCheckDate ? new Date(body.bgCheckDate) : null,
        deviceAssignment: body.deviceAssignment,
        userId: body.userId === undefined ? undefined : body.userId || null,
      },
    });
    await writeAuditEvent({ actorId: user.id, action: "personnel.update", entityType: "personnel", entityId: id, metadata: { fullName: updated.fullName } });
    return updated;
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "personnel");
    const { id } = await params;
    const existing = await prisma.personnel.findFirst({ where: { id, orgId: user.orgId }, select: { id: true, fullName: true } });
    if (!existing) throw new HttpError(404, "Personnel not found");
    await prisma.personnel.delete({ where: { id } });
    await writeAuditEvent({ actorId: user.id, action: "personnel.delete", entityType: "personnel", entityId: id, metadata: { fullName: existing.fullName } });
    return { ok: true };
  });
}
