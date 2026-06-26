import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { route } from "@/lib/api";
import { forgotSchema } from "@/lib/validation";
import { getMailer } from "@/lib/mailer";

// Request a password reset. Always returns ok (no account enumeration). When the email matches a
// user, a single-use token (hashed at rest) is stored and a reset link is emailed.
export async function POST(req: Request) {
  return route(async () => {
    const { email } = forgotSchema.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    if (user && user.isActive) {
      const token = randomBytes(32).toString("base64url");
      const tokenHash = createHash("sha256").update(token).digest("hex");
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetTokenHash: tokenHash,
          passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        },
      });
      const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
      await getMailer().send({
        to: user.email,
        subject: "Reset your Lustrew CyberStar password",
        text: `Use this link within 1 hour to reset your password:\n\n${base}/reset?token=${token}\n\nIf you didn't request this, ignore this email.`,
      });
    }

    return { ok: true };
  });
}
