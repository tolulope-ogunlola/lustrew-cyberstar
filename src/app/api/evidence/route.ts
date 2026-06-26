import { prisma } from "@/lib/db";
import { HttpError, requireUser, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { evidenceCreateSchema } from "@/lib/validation";

// GET /api/evidence?systemId=X -> evidence for a system, with linked control ids/titles.
export async function GET(req: Request) {
  return route(async () => {
    const user = await requireUser();
    const systemId = new URL(req.url).searchParams.get("systemId");
    if (!systemId) throw new HttpError(400, "systemId is required");

    const system = await prisma.system.findFirst({
      where: { id: systemId, orgId: user.orgId },
      select: { id: true },
    });
    if (!system) throw new HttpError(404, "System not found");

    const rows = await prisma.evidence.findMany({
      where: { systemId },
      orderBy: { createdAt: "desc" },
      include: {
        uploadedBy: { select: { name: true } },
        links: {
          include: {
            implementation: { include: { control: { select: { controlId: true } } } },
          },
        },
      },
    });
    // Expose file presence/metadata but not the internal storage ref.
    return rows.map(({ fileRef, ...e }) => ({ ...e, hasFile: Boolean(fileRef) }));
  });
}

export async function POST(req: Request) {
  return route(async () => {
    const user = await requirePermission("write", "evidence");
    const body = evidenceCreateSchema.parse(await req.json());

    const system = await prisma.system.findFirst({
      where: { id: body.systemId, orgId: user.orgId },
      select: { id: true },
    });
    if (!system) throw new HttpError(404, "System not found");

    const evidence = await prisma.evidence.create({
      data: {
        systemId: body.systemId,
        title: body.title,
        type: body.type,
        url: body.url ?? "",
        note: body.note ?? "",
        uploadedById: user.id,
        links: {
          create: (body.implementationIds ?? []).map((implementationId) => ({
            implementationId,
          })),
        },
      },
    });

    await writeAuditEvent({
      actorId: user.id,
      action: "evidence.create",
      entityType: "evidence",
      entityId: evidence.id,
      metadata: { title: evidence.title, links: body.implementationIds?.length ?? 0 },
    });

    return evidence;
  });
}
