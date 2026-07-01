import { prisma } from "@/lib/db";
import { HttpError, requireUser, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { trustCenterUpdateSchema } from "@/lib/validation";

async function ensureTrustCenter(orgId: string) {
  const existing = await prisma.trustCenter.findUnique({ where: { orgId } });
  if (existing) return existing;
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } });
  return prisma.trustCenter.create({ data: { orgId, companyName: org?.name ?? "" } });
}

export async function GET() {
  return route(async () => {
    const user = await requireUser();
    const tc = await ensureTrustCenter(user.orgId);
    const org = await prisma.organization.findUnique({ where: { id: user.orgId }, select: { slug: true } });
    return {
      ...tc,
      slug: org?.slug ?? null,
      frameworks: JSON.parse(tc.frameworks || "[]"),
      subprocessors: JSON.parse(tc.subprocessors || "[]"),
    };
  });
}

export async function PATCH(req: Request) {
  return route(async () => {
    const user = await requirePermission("write", "trustcenter");
    const body = trustCenterUpdateSchema.parse(await req.json());
    await ensureTrustCenter(user.orgId);

    // Slug lives on Organization (it addresses the public path). Enforce global uniqueness.
    if (body.slug !== undefined) {
      const taken = await prisma.organization.findFirst({ where: { slug: body.slug, NOT: { id: user.orgId } }, select: { id: true } });
      if (taken) throw new HttpError(409, "That Trust Center URL is already taken");
      await prisma.organization.update({ where: { id: user.orgId }, data: { slug: body.slug } });
    }

    const tc = await prisma.trustCenter.update({
      where: { orgId: user.orgId },
      data: {
        published: body.published,
        companyName: body.companyName,
        headline: body.headline,
        overview: body.overview,
        frameworks: body.frameworks === undefined ? undefined : JSON.stringify(body.frameworks),
        subprocessors: body.subprocessors === undefined ? undefined : JSON.stringify(body.subprocessors),
        statusUrl: body.statusUrl,
        contactEmail: body.contactEmail,
      },
    });
    await writeAuditEvent({ actorId: user.id, action: "trustcenter.update", entityType: "trustcenter", entityId: tc.id, metadata: { published: tc.published } });
    return { ok: true };
  });
}
