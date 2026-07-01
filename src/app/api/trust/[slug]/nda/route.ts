import { prisma } from "@/lib/db";
import { ndaAcceptSchema } from "@/lib/validation";
import { hashIp, clientIp } from "@/lib/trust/tokens";
import { CURRENT_NDA_HASH } from "@/lib/trust/nda";
import { checkRateLimit } from "@/lib/rateLimit";

// Public: record clickwrap NDA acceptance for a pending access request (append-only, evidentiary).
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ip = clientIp(req);
  const ipHash = hashIp(ip);
  if (!checkRateLimit(`trust-nda:${ipHash}`, 20, 60 * 60 * 1000)) {
    return Response.json({ error: "Too many requests." }, { status: 429 });
  }

  const org = await prisma.organization.findUnique({ where: { slug }, select: { id: true } });
  if (!org) return Response.json({ error: "Not found" }, { status: 404 });

  let body;
  try {
    body = ndaAcceptSchema.parse(await req.json());
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Invalid request" }, { status: 400 });
  }

  const request = await prisma.accessRequest.findFirst({
    where: { id: body.accessRequestId, orgId: org.id },
    select: { id: true, email: true, nda: { select: { id: true } } },
  });
  if (!request) return Response.json({ error: "Not found" }, { status: 404 });
  if (request.nda) return Response.json({ ok: true }); // idempotent

  await prisma.ndaAcceptance.create({
    data: {
      accessRequestId: request.id,
      ndaVersion: body.ndaVersion,
      ndaTextHash: CURRENT_NDA_HASH,
      acceptedName: body.acceptedName,
      acceptedEmail: request.email,
      ipHash,
      userAgent: (req.headers.get("user-agent") || "").slice(0, 400),
    },
  });
  return Response.json({ ok: true });
}
