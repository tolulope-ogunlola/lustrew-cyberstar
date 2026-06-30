import { prisma } from "@/lib/db";

// Public, unauthenticated Trust Center profile. Returns an identical 404 for a missing org, an
// unpublished Trust Center, or a bad slug (no enumeration signal).
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const notFound = () => new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } });

  const org = await prisma.organization.findUnique({ where: { slug }, select: { id: true } });
  if (!org) return notFound();
  const tc = await prisma.trustCenter.findUnique({ where: { orgId: org.id } });
  if (!tc || !tc.published) return notFound();

  const documents = await prisma.trustDocument.findMany({
    where: { trustCenterId: tc.id, active: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, category: true, visibility: true, requiresNda: true },
  });

  return Response.json(
    {
      companyName: tc.companyName,
      headline: tc.headline,
      overview: tc.overview,
      frameworks: JSON.parse(tc.frameworks || "[]"),
      subprocessors: JSON.parse(tc.subprocessors || "[]"),
      statusUrl: tc.statusUrl,
      contactEmail: tc.contactEmail,
      documents,
    },
    { headers: { "Cache-Control": "public, max-age=60" } }
  );
}
