import { prisma } from "@/lib/db";
import { HttpError, requireUser, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { verifyPassword } from "@/lib/password";
import { generateMfaSecret, otpauthUrl, verifyTotp } from "@/lib/totp";
import { z } from "zod";

const schema = z.object({
  action: z.enum(["init", "enable", "disable"]),
  token: z.string().optional(),
  password: z.string().optional(),
});

// MFA (TOTP) enrollment lifecycle:
//   init    -> generate a secret (stored, not yet enabled), return otpauth URL to scan
//   enable  -> verify a code against the pending secret, switch MFA on
//   disable -> verify the account password, switch MFA off and clear the secret
export async function POST(req: Request) {
  return route(async () => {
    const user = await requireUser();
    const { action, token, password } = schema.parse(await req.json());
    const u = await prisma.user.findUnique({ where: { id: user.id } });
    if (!u) throw new HttpError(404, "User not found");

    if (action === "init") {
      const secret = generateMfaSecret();
      await prisma.user.update({ where: { id: user.id }, data: { mfaSecret: secret, mfaEnabled: false } });
      return { secret, otpauthUrl: otpauthUrl(u.email, secret) };
    }

    if (action === "enable") {
      if (!u.mfaSecret) throw new HttpError(400, "Start enrollment first");
      if (!verifyTotp(token ?? "", u.mfaSecret)) throw new HttpError(400, "Invalid code");
      await prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: true } });
      await writeAuditEvent({ actorId: user.id, action: "account.mfa_enable", entityType: "user", entityId: user.id });
      return { mfaEnabled: true };
    }

    // disable
    if (!(await verifyPassword(password ?? "", u.passwordHash))) {
      throw new HttpError(400, "Password is incorrect");
    }
    await prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: false, mfaSecret: null } });
    await writeAuditEvent({ actorId: user.id, action: "account.mfa_disable", entityType: "user", entityId: user.id });
    return { mfaEnabled: false };
  });
}
