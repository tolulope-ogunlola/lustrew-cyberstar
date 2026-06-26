import { prisma } from "@/lib/db";
import { HttpError, requireUser, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { organizationUpdateSchema } from "@/lib/validation";

// GET /api/organization — current org, plan, and member/system counts.
export async function GET() {
  return route(async () => {
    const user = await requireUser();
    const org = await prisma.organization.findUnique({
      where: { id: user.orgId },
      select: { id: true, name: true, plan: true, billingEmail: true, createdAt: true, _count: { select: { users: true, systems: true } } },
    });
    if (!org) throw new HttpError(404, "Organization not found");
    return org;
  });
}

// PATCH /api/organization — ADMIN updates org name / plan / billing email (self-serve, mock billing).
export async function PATCH(req: Request) {
  return route(async () => {
    const user = await requireUser();
    if (user.role !== "ADMIN") throw new HttpError(403, "Only an administrator can change organization settings.");
    const body = organizationUpdateSchema.parse(await req.json());

    const org = await prisma.organization.update({
      where: { id: user.orgId },
      data: { name: body.name, plan: body.plan, billingEmail: body.billingEmail },
      select: { id: true, name: true, plan: true, billingEmail: true },
    });
    await writeAuditEvent({
      actorId: user.id,
      action: "org.update",
      entityType: "organization",
      entityId: org.id,
      metadata: { plan: org.plan },
    });
    return org;
  });
}
