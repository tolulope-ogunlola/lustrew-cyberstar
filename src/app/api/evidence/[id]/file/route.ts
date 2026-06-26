import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { storage } from "@/lib/storage";

// Authenticated, org-scoped download. Files are never served from a public directory.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await currentUser();
  if (!user) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });

  const { id } = await params;
  const evidence = await prisma.evidence.findFirst({
    where: { id, system: { orgId: user.orgId } },
    select: { fileRef: true, fileName: true, contentType: true },
  });
  if (!evidence?.fileRef) {
    return new Response(JSON.stringify({ error: "File not found" }), { status: 404 });
  }

  try {
    const bytes = await storage().get(evidence.fileRef);
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": evidence.contentType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${(evidence.fileName || "evidence").replace(/"/g, "")}"`,
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: "File unavailable" }), { status: 404 });
  }
}
