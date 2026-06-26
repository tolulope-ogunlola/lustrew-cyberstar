import { prisma } from "@/lib/db";
import { HttpError, requireUser, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { generateTempPassword, hashPassword } from "@/lib/password";
import { userCreateSchema } from "@/lib/validation";
import { getMailer } from "@/lib/mailer";

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new HttpError(403, "Admin only");
  return user;
}

export async function GET() {
  return route(async () => {
    const admin = await requireAdmin();
    return prisma.user.findMany({
      where: { orgId: admin.orgId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        mfaEnabled: true,
        mustChangePassword: true,
        createdAt: true,
      },
    });
  });
}

// Invite/create a user in the admin's org. A temp password is generated, emailed, and also
// returned so the admin can relay it; the new user must change it at first sign-in.
export async function POST(req: Request) {
  return route(async () => {
    const admin = await requireAdmin();
    const body = userCreateSchema.parse(await req.json());
    const email = body.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new HttpError(409, "A user with that email already exists");

    const tempPassword = generateTempPassword();
    const created = await prisma.user.create({
      data: {
        name: body.name,
        email,
        role: body.role,
        orgId: admin.orgId,
        passwordHash: await hashPassword(tempPassword),
        mustChangePassword: true,
      },
      select: { id: true, name: true, email: true, role: true },
    });

    const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
    await getMailer().send({
      to: email,
      subject: "Your Lustrew CyberStar account",
      text: `An account was created for you.\n\nSign in at ${base}/login\nEmail: ${email}\nTemporary password: ${tempPassword}\n\nYou'll be asked to change it after signing in.`,
    });

    await writeAuditEvent({
      actorId: admin.id,
      action: "user.create",
      entityType: "user",
      entityId: created.id,
      metadata: { email, role: body.role },
    });

    return { ...created, tempPassword };
  });
}
