import { prisma } from "@/lib/db";
import { accessRequestPublicSchema } from "@/lib/validation";
import { hashIp, clientIp } from "@/lib/trust/tokens";
import { checkRateLimit } from "@/lib/rateLimit";
import { getMailer } from "@/lib/mailer";

// Public: capture an access request for gated documents. Rate-limited per IP and per email.
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ip = clientIp(req);
  const ipHash = hashIp(ip);

  if (!checkRateLimit(`trust-request:${ipHash}`, 10, 60 * 60 * 1000)) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const org = await prisma.organization.findUnique({ where: { slug }, select: { id: true } });
  if (!org) return Response.json({ error: "Not found" }, { status: 404 });
  const tc = await prisma.trustCenter.findUnique({ where: { orgId: org.id }, select: { id: true, published: true } });
  if (!tc || !tc.published) return Response.json({ error: "Not found" }, { status: 404 });

  let body;
  try {
    body = accessRequestPublicSchema.parse(await req.json());
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Invalid request" }, { status: 400 });
  }

  if (!checkRateLimit(`trust-request-email:${body.email.toLowerCase()}`, 5, 60 * 60 * 1000)) {
    return Response.json({ error: "Too many requests for this email." }, { status: 429 });
  }

  // Only allow requesting documents that belong to this published Trust Center.
  const validDocs = await prisma.trustDocument.findMany({
    where: { id: { in: body.requestedDocs }, trustCenterId: tc.id, active: true },
    select: { id: true },
  });
  if (!validDocs.length) return Response.json({ error: "No valid documents selected" }, { status: 400 });

  const request = await prisma.accessRequest.create({
    data: {
      trustCenterId: tc.id,
      orgId: org.id,
      email: body.email,
      name: body.name ?? "",
      company: body.company ?? "",
      reason: body.reason ?? "",
      requestedDocs: JSON.stringify(validDocs.map((d) => d.id)),
      ipHash,
    },
  });

  // Notify org admins that a request is pending.
  const admins = await prisma.user.findMany({ where: { orgId: org.id, role: { in: ["ADMIN", "ATO_SME"] }, isActive: true }, select: { email: true } });
  if (admins.length) {
    await getMailer().send({
      to: admins.map((a) => a.email).join(", "),
      subject: "New Trust Center document access request",
      text: `${body.name || body.email} (${body.company || "—"}) requested access to ${validDocs.length} document(s). Review it in the Trust Center admin.`,
    });
  }

  return Response.json({ ok: true, accessRequestId: request.id });
}
