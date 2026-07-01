import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { parseQuestionnaire } from "@/lib/questionnaire/import";
import { MAX_UPLOAD_BYTES } from "@/lib/storage";

// POST multipart: name, customer?, file (CSV or XLSX). Creates a Questionnaire with parsed items.
export async function POST(req: Request) {
  return route(async () => {
    const user = await requirePermission("write", "questionnaire");
    const form = await req.formData();
    const name = String(form.get("name") || "").trim();
    const customer = String(form.get("customer") || "");
    const file = form.get("file");

    if (!name) throw new HttpError(400, "name is required");
    if (!(file instanceof File)) throw new HttpError(400, "file is required");
    if (file.size > MAX_UPLOAD_BYTES) throw new HttpError(413, "File too large");

    const bytes = Buffer.from(await file.arrayBuffer());
    const items = await parseQuestionnaire(bytes, file.name);
    if (!items.length) throw new HttpError(422, "No questions detected in the file");

    const q = await prisma.questionnaire.create({
      data: {
        orgId: user.orgId,
        name,
        customer,
        sourceFile: file.name,
        createdById: user.id,
        items: { create: items.map((it) => ({ rowIndex: it.rowIndex, section: it.section, question: it.question })) },
      },
      include: { _count: { select: { items: true } } },
    });
    await writeAuditEvent({ actorId: user.id, action: "questionnaire.import", entityType: "questionnaire", entityId: q.id, metadata: { items: items.length, file: file.name } });
    return { id: q.id, items: q._count.items };
  });
}
