import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { z } from "zod";

const patchSchema = z.object({
  state: z.enum(["OPEN", "REMEDIATED", "RISK_ACCEPTED", "FALSE_POSITIVE"]),
});

// PATCH -> triage state change (risk-accept, false positive, remediated, reopen).
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return route(async () => {
    const user = await requirePermission("write", "vuln");
    const { id } = await params;
    const body = patchSchema.parse(await req.json());

    const vuln = await prisma.vulnerability.findFirst({
      where: { id, system: { orgId: user.orgId } },
      select: { id: true, title: true },
    });
    if (!vuln) throw new HttpError(404, "Vulnerability not found");

    const updated = await prisma.vulnerability.update({
      where: { id },
      data: { state: body.state },
    });

    await writeAuditEvent({
      actorId: user.id,
      action: "vuln.state_change",
      entityType: "vulnerability",
      entityId: id,
      metadata: { state: body.state, title: vuln.title },
    });

    return updated;
  });
}
