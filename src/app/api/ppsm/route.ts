import { prisma } from "@/lib/db";
import { HttpError, requireUser, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { ppsmCreateSchema } from "@/lib/validation";

// GET /api/ppsm?systemId=X -> PPSM register for a system.
export async function GET(req: Request) {
  return route(async () => {
    const user = await requireUser();
    const systemId = new URL(req.url).searchParams.get("systemId");
    if (!systemId) throw new HttpError(400, "systemId is required");
    const system = await prisma.system.findFirst({ where: { id: systemId, orgId: user.orgId }, select: { id: true } });
    if (!system) throw new HttpError(404, "System not found");
    return prisma.ppsmEntry.findMany({ where: { systemId }, orderBy: [{ status: "asc" }, { port: "asc" }] });
  });
}

export async function POST(req: Request) {
  return route(async () => {
    const user = await requirePermission("write", "ppsm");
    const body = ppsmCreateSchema.parse(await req.json());
    const system = await prisma.system.findFirst({ where: { id: body.systemId, orgId: user.orgId }, select: { id: true } });
    if (!system) throw new HttpError(404, "System not found");

    const entry = await prisma.ppsmEntry.create({
      data: {
        systemId: body.systemId,
        port: body.port,
        protocol: body.protocol,
        service: body.service,
        direction: body.direction,
        source: body.source ?? "",
        destination: body.destination ?? "",
        justification: body.justification ?? "",
        status: body.status,
        associatedControl: body.associatedControl || null,
      },
    });
    await writeAuditEvent({
      actorId: user.id,
      action: "ppsm.create",
      entityType: "ppsmEntry",
      entityId: entry.id,
      metadata: { port: entry.port, protocol: entry.protocol, service: entry.service },
    });
    return entry;
  });
}
