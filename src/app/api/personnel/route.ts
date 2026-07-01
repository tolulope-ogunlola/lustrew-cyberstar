import { prisma } from "@/lib/db";
import { HttpError, requireUser, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { personnelCreateSchema } from "@/lib/validation";
import { personComplianceStatus } from "@/lib/personnel";

export async function GET() {
  return route(async () => {
    const user = await requireUser();

    const [people, approvedPolicies] = await Promise.all([
      prisma.personnel.findMany({
        where: { orgId: user.orgId },
        orderBy: { fullName: "asc" },
        include: {
          user: { select: { id: true, mfaEnabled: true } },
          trainingAssignments: { select: { status: true, dueDate: true } },
          accessReviews: { select: { status: true, dueDate: true } },
          onboardingTasks: { select: { done: true, dueDate: true } },
        },
      }),
      prisma.policy.findMany({ where: { orgId: user.orgId, status: "APPROVED" }, select: { id: true } }),
    ]);

    const approvedIds = approvedPolicies.map((p) => p.id);
    const userIds = people.map((p) => p.user?.id).filter((x): x is string => !!x);
    const acks = approvedIds.length
      ? await prisma.policyAck.findMany({
          where: { policyId: { in: approvedIds }, userId: { in: userIds } },
          select: { userId: true },
        })
      : [];
    const ackCountByUser = new Map<string, number>();
    for (const a of acks) ackCountByUser.set(a.userId, (ackCountByUser.get(a.userId) ?? 0) + 1);

    const now = new Date();
    return people.map((p) => {
      // Contractors with no app user are not subject to MFA/policy-ack signals.
      const requiredPoliciesAcked = !p.user
        ? true
        : (ackCountByUser.get(p.user.id) ?? 0) >= approvedIds.length;
      const compliance = personComplianceStatus(
        {
          status: p.status,
          mfaEnabled: p.user ? p.user.mfaEnabled : null,
          bgCheckStatus: p.bgCheckStatus,
          trainings: p.trainingAssignments,
          accessReviews: p.accessReviews,
          onboardingTasks: p.onboardingTasks,
          requiredPoliciesAcked,
        },
        now
      );
      const { trainingAssignments, accessReviews, onboardingTasks, user: linked, ...rest } = p;
      return {
        ...rest,
        mfaEnabled: linked ? linked.mfaEnabled : null,
        trainingCount: trainingAssignments.length,
        accessReviewCount: accessReviews.length,
        onboardingOpen: onboardingTasks.filter((t) => !t.done).length,
        compliance,
      };
    });
  });
}

export async function POST(req: Request) {
  return route(async () => {
    const user = await requirePermission("write", "personnel");
    const body = personnelCreateSchema.parse(await req.json());

    // If linking an app user, ensure it belongs to this org and isn't already linked.
    if (body.userId) {
      const u = await prisma.user.findFirst({ where: { id: body.userId, orgId: user.orgId }, select: { id: true } });
      if (!u) throw new HttpError(404, "User not found in your organization");
      const taken = await prisma.personnel.findUnique({ where: { userId: body.userId }, select: { id: true } });
      if (taken) throw new HttpError(409, "That user is already linked to a personnel record");
    }

    const person = await prisma.personnel.create({
      data: {
        orgId: user.orgId,
        fullName: body.fullName,
        email: body.email ?? "",
        personnelType: body.personnelType,
        department: body.department ?? "",
        jobTitle: body.jobTitle ?? "",
        status: body.status,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        bgCheckStatus: body.bgCheckStatus,
        bgCheckDate: body.bgCheckDate ? new Date(body.bgCheckDate) : null,
        deviceAssignment: body.deviceAssignment ?? "",
        userId: body.userId || null,
      },
    });
    await writeAuditEvent({ actorId: user.id, action: "personnel.create", entityType: "personnel", entityId: person.id, metadata: { fullName: person.fullName } });
    return person;
  });
}
