import { prisma } from "@/lib/db";
import { HttpError, requireUser, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/password";
import { passwordChangeSchema } from "@/lib/validation";

// Self-service password change. Verifies the current password and clears mustChangePassword.
export async function POST(req: Request) {
  return route(async () => {
    const user = await requireUser();
    const body = passwordChangeSchema.parse(await req.json());

    const u = await prisma.user.findUnique({ where: { id: user.id } });
    if (!u) throw new HttpError(404, "User not found");

    const ok = await verifyPassword(body.currentPassword, u.passwordHash);
    if (!ok) throw new HttpError(400, "Current password is incorrect");

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(body.newPassword), mustChangePassword: false },
    });

    await writeAuditEvent({
      actorId: user.id,
      action: "account.password_change",
      entityType: "user",
      entityId: user.id,
    });

    return { ok: true };
  });
}
