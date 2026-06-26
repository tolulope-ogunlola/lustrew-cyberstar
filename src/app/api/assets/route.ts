import { prisma } from "@/lib/db";
import { HttpError, requirePermission, requireUser, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { assetCreateSchema } from "@/lib/validation";

// GET /api/assets?systemId=X — asset inventory for a system (CMMC CUI boundary scoping).
export async function GET(req: Request) {
  return route(async () => {
    const user = await requireUser();
    const systemId = new URL(req.url).searchParams.get("systemId");
    if (!systemId) throw new HttpError(400, "systemId is required");
    const system = await prisma.system.findFirst({ where: { id: systemId, orgId: user.orgId }, select: { id: true } });
    if (!system) throw new HttpError(404, "System not found");
    return prisma.asset.findMany({ where: { systemId }, orderBy: [{ category: "asc" }, { name: "asc" }] });
  });
}

// POST /api/assets — add an asset. Asset inventory is part of system scoping (controls write).
export async function POST(req: Request) {
  return route(async () => {
    const user = await requirePermission("write", "system");
    const body = assetCreateSchema.parse(await req.json());
    const system = await prisma.system.findFirst({ where: { id: body.systemId, orgId: user.orgId }, select: { id: true } });
    if (!system) throw new HttpError(404, "System not found");

    const asset = await prisma.asset.create({
      data: {
        systemId: body.systemId,
        name: body.name,
        assetType: body.assetType ?? "Other",
        category: body.category ?? "OUT_OF_SCOPE",
        description: body.description ?? "",
        owner: body.owner ?? "",
        location: body.location ?? "",
      },
    });
    await writeAuditEvent({ actorId: user.id, action: "asset.create", entityType: "system", entityId: body.systemId, metadata: { asset: asset.name, category: asset.category } });
    return asset;
  });
}
