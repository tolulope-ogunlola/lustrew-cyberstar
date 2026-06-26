import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({
  status: z.enum(["OPEN", "NOT_A_FINDING", "NOT_APPLICABLE", "NOT_REVIEWED"]).optional(),
  comments: z.string().max(8000).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "stig");
    const { id } = await params;
    const body = schema.parse(await req.json());

    const finding = await prisma.stigFinding.findFirst({
      where: { id, system: { orgId: user.orgId } },
      select: { id: true, vulnNum: true },
    });
    if (!finding) throw new HttpError(404, "Finding not found");

    const updated = await prisma.stigFinding.update({
      where: { id },
      data: { status: body.status, comments: body.comments },
    });

    await writeAuditEvent({
      actorId: user.id,
      action: "stig.update",
      entityType: "stigFinding",
      entityId: id,
      metadata: { vulnNum: finding.vulnNum, status: updated.status },
    });

    return updated;
  });
}
