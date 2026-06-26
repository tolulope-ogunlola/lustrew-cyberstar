import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { HttpError, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { hashPassword } from "@/lib/password";
import { resetSchema } from "@/lib/validation";

// Complete a password reset with a valid, unexpired token.
export async function POST(req: Request) {
  return route(async () => {
    const { token, password } = resetSchema.parse(await req.json());
    const tokenHash = createHash("sha256").update(token).digest("hex");

    const user = await prisma.user.findFirst({
      where: { passwordResetTokenHash: tokenHash, passwordResetExpires: { gt: new Date() } },
    });
    if (!user) throw new HttpError(400, "Invalid or expired reset link");

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(password),
        passwordResetTokenHash: null,
        passwordResetExpires: null,
        mustChangePassword: false,
      },
    });

    await writeAuditEvent({
      actorId: user.id,
      action: "account.password_reset",
      entityType: "user",
      entityId: user.id,
    });

    return { ok: true };
  });
}
