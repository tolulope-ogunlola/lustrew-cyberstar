import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { hashToken, hashIp, clientIp } from "@/lib/trust/tokens";
import { checkRateLimit } from "@/lib/rateLimit";

// Public, tokenized document download. Returns an identical 404 for any failure (unknown/expired/
// revoked/over-cap token, or missing file) to avoid leaking token validity. Files are streamed
// from secure storage — never served from a public directory.
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ipHash = hashIp(clientIp(req));
  const ua = (req.headers.get("user-agent") || "").slice(0, 400);
  const notFound = () => new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } });

  if (!checkRateLimit(`trust-doc:${ipHash}`, 60, 60 * 60 * 1000)) {
    return new Response(JSON.stringify({ error: "Too many requests" }), { status: 429, headers: { "Content-Type": "application/json" } });
  }

  const grant = await prisma.accessGrant.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { document: { select: { id: true, fileRef: true, fileName: true, contentType: true } } },
  });
  if (!grant) return notFound();

  const now = new Date();
  const invalid = !!grant.revokedAt || grant.expiresAt < now || grant.downloadCount >= grant.maxDownloads;
  if (invalid) {
    await prisma.accessLog.create({
      data: { grantId: grant.id, orgId: grant.orgId, documentId: grant.documentId, email: grant.email, event: grant.expiresAt < now ? "TOKEN_EXPIRED" : "DENIED", ipHash, userAgent: ua },
    });
    return notFound();
  }

  const ref = grant.document.fileRef;
  if (!ref) return notFound();

  let bytes: Buffer;
  try {
    bytes = await storage().get(ref);
  } catch {
    return notFound();
  }

  await prisma.$transaction([
    prisma.accessGrant.update({ where: { id: grant.id }, data: { downloadCount: { increment: 1 } } }),
    prisma.accessLog.create({ data: { grantId: grant.id, orgId: grant.orgId, documentId: grant.documentId, email: grant.email, event: "DOWNLOAD", ipHash, userAgent: ua } }),
  ]);

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": grant.document.contentType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${(grant.document.fileName || "document").replace(/"/g, "")}"`,
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
