import { prisma } from "@/lib/db";
import { HttpError, route } from "@/lib/api";
import { signupSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/password";
import { writeAuditEvent } from "@/lib/audit";
import { isLoginBlocked, recordLoginFailure } from "@/lib/rateLimit";

// POST /api/signup — self-service tenant creation: a new Organization + its first ADMIN user.
// Gated behind SIGNUP_ENABLED (off by default) and throttled per IP.
export async function POST(req: Request) {
  return route(async () => {
    if (process.env.SIGNUP_ENABLED !== "true") throw new HttpError(403, "Self-service signup is disabled.");

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rlKey = `signup:${ip}`;
    if (isLoginBlocked(rlKey)) throw new HttpError(429, "Too many signups from this network. Try again later.");
    recordLoginFailure(rlKey);

    const body = signupSchema.parse(await req.json());

    const existing = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() }, select: { id: true } });
    if (existing) throw new HttpError(409, "An account with that email already exists.");

    const passwordHash = await hashPassword(body.password);
    const org = await prisma.organization.create({
      data: {
        name: body.orgName,
        plan: "FREE",
        billingEmail: body.email.toLowerCase(),
        users: {
          create: { name: body.name, email: body.email.toLowerCase(), role: "ADMIN", passwordHash },
        },
      },
      include: { users: { select: { id: true } } },
    });

    await writeAuditEvent({
      actorId: org.users[0]?.id,
      action: "org.signup",
      entityType: "organization",
      entityId: org.id,
      metadata: { plan: "FREE" },
    });

    return { ok: true, orgId: org.id };
  });
}
