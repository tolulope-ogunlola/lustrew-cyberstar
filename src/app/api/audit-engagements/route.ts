import { prisma } from "@/lib/db";
import { HttpError, requireUser, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { generateTempPassword, hashPassword } from "@/lib/password";
import { auditEngagementCreateSchema } from "@/lib/validation";
import { getMailer } from "@/lib/mailer";

export async function GET() {
  return route(async () => {
    const user = await requireUser();
    return prisma.auditEngagement.findMany({
      where: { orgId: user.orgId },
      orderBy: { createdAt: "desc" },
      include: { system: { select: { name: true } }, auditor: { select: { name: true, email: true } } },
    });
  });
}

// Invite an external auditor and grant a scoped, time-boxed engagement on one system.
export async function POST(req: Request) {
  return route(async () => {
    const admin = await requirePermission("write", "auditEngagement");
    const body = auditEngagementCreateSchema.parse(await req.json());
    const email = body.auditorEmail.toLowerCase();

    const system = await prisma.system.findFirst({ where: { id: body.systemId, orgId: admin.orgId }, select: { id: true } });
    if (!system) throw new HttpError(404, "System not found");

    // Reuse or create the external auditor user (role ASSESSOR, isExternal).
    let auditor = await prisma.user.findUnique({ where: { email }, select: { id: true, orgId: true, isExternal: true } });
    let tempPassword: string | null = null;
    if (!auditor) {
      tempPassword = generateTempPassword();
      auditor = await prisma.user.create({
        data: {
          name: body.auditorName,
          email,
          role: "ASSESSOR",
          isExternal: true,
          orgId: admin.orgId,
          passwordHash: await hashPassword(tempPassword),
          mustChangePassword: true,
        },
        select: { id: true, orgId: true, isExternal: true },
      });
    } else if (auditor.orgId !== admin.orgId || !auditor.isExternal) {
      throw new HttpError(409, "That email belongs to a non-external user");
    }

    const existing = await prisma.auditEngagement.findUnique({ where: { systemId_auditorId: { systemId: body.systemId, auditorId: auditor.id } }, select: { id: true } });
    if (existing) throw new HttpError(409, "An engagement already exists for that auditor on this system");

    const engagement = await prisma.auditEngagement.create({
      data: {
        orgId: admin.orgId,
        systemId: body.systemId,
        auditorId: auditor.id,
        invitedById: admin.id,
        title: body.title ?? "",
        status: "ACTIVE",
        scopes: JSON.stringify(body.scopes),
        expiresAt: new Date(Date.now() + body.expiresInDays * 86_400_000),
      },
    });

    const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
    await getMailer().send({
      to: email,
      subject: "You have been invited to an audit engagement",
      text:
        `You have been granted read-only auditor access to a single system for ${body.expiresInDays} day(s).\n\n` +
        `Sign in at ${base}/login\nEmail: ${email}` +
        (tempPassword ? `\nTemporary password: ${tempPassword}\n\nYou'll be asked to change it at first sign-in.` : "") +
        `\n\nAfter signing in you'll land on the auditor portal scoped to your engagement.`,
    });

    await writeAuditEvent({ actorId: admin.id, action: "audit_engagement.create", entityType: "auditEngagement", entityId: engagement.id, metadata: { email, systemId: body.systemId, scopes: body.scopes } });
    return { id: engagement.id, ...(tempPassword ? { tempPassword } : {}) };
  });
}
