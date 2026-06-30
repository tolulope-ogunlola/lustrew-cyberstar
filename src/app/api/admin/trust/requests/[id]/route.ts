import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { accessDecisionSchema } from "@/lib/validation";
import { issueGrantToken } from "@/lib/trust/tokens";
import { getMailer } from "@/lib/mailer";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "trustcenter");
    const { id } = await params;
    const body = accessDecisionSchema.parse(await req.json());

    const reqRow = await prisma.accessRequest.findFirst({
      where: { id, orgId: user.orgId },
      include: { nda: true },
    });
    if (!reqRow) throw new HttpError(404, "Request not found");
    if (reqRow.status !== "PENDING") throw new HttpError(400, "Request already decided");

    if (body.decision === "DENY") {
      await prisma.accessRequest.update({ where: { id }, data: { status: "DENIED", decidedById: user.id, decidedAt: new Date() } });
      await writeAuditEvent({ actorId: user.id, action: "trustcenter.access.deny", entityType: "trustcenter", entityId: id, metadata: { email: reqRow.email } });
      return { ok: true, decision: "DENIED" };
    }

    // Approve: NDA must be accepted for gated docs.
    if (!reqRow.nda) throw new HttpError(400, "Requester has not accepted the NDA");

    const docIds: string[] = JSON.parse(reqRow.requestedDocs || "[]");
    const docs = await prisma.trustDocument.findMany({ where: { id: { in: docIds }, orgId: user.orgId, active: true }, select: { id: true, title: true } });
    if (!docs.length) throw new HttpError(400, "No valid documents to grant");

    const expiresAt = new Date(Date.now() + body.expiresInDays * 86_400_000);
    const links: string[] = [];
    const baseUrl = process.env.NEXTAUTH_URL || "";
    for (const doc of docs) {
      const { token, tokenHash } = issueGrantToken();
      await prisma.accessGrant.create({
        data: { accessRequestId: id, documentId: doc.id, orgId: user.orgId, tokenHash, email: reqRow.email, expiresAt },
      });
      links.push(`- ${doc.title}: ${baseUrl}/api/trust/document/${token}`);
    }

    await prisma.accessRequest.update({ where: { id }, data: { status: "APPROVED", decidedById: user.id, decidedAt: new Date() } });

    await getMailer().send({
      to: reqRow.email,
      subject: "Your secure document access has been approved",
      text:
        `Hello ${reqRow.name || ""},\n\nYour request to access secure documentation has been approved. ` +
        `The links below are personal, time-limited (expire ${expiresAt.toISOString().slice(0, 10)}), and download-capped.\n\n` +
        `${links.join("\n")}\n\nDo not share these links.`,
    });

    await writeAuditEvent({ actorId: user.id, action: "trustcenter.access.approve", entityType: "trustcenter", entityId: id, metadata: { email: reqRow.email, docs: docs.length } });
    return { ok: true, decision: "APPROVED", grants: docs.length };
  });
}
