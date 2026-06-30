import { prisma } from "@/lib/db";
import { HttpError, requireUser, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { renderReport, FORMAT_META, type ReportFormat } from "@/lib/report/format";
import type { ReportTable } from "@/lib/report/data";

// GET ?format=xlsx|csv|pdf — export the answered questionnaire. Refuses unless every item is APPROVED.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const format = (new URL(req.url).searchParams.get("format") || "xlsx") as ReportFormat;
  if (!FORMAT_META[format]) return Response.json({ error: "Invalid format" }, { status: 400 });

  const q = await prisma.questionnaire.findFirst({
    where: { id, orgId: user.orgId },
    include: { items: { orderBy: { rowIndex: "asc" } } },
  });
  if (!q) return Response.json({ error: "Questionnaire not found" }, { status: 404 });

  const unapproved = q.items.filter((i) => i.status !== "APPROVED").length;
  if (unapproved > 0) {
    return Response.json({ error: `${unapproved} item(s) are not yet approved. Approve all answers before export.` }, { status: 400 });
  }

  const table: ReportTable = {
    title: `Security Questionnaire — ${q.name}`,
    system: q.customer || "—",
    generatedAt: new Date().toISOString(),
    columns: [
      { key: "section", label: "Section", width: 18 },
      { key: "question", label: "Question", width: 60 },
      { key: "answer", label: "Answer", width: 80 },
    ],
    rows: q.items.map((i) => ({ section: i.section, question: i.question, answer: i.approvedAnswer })),
  };

  const buf = await renderReport(table, format);
  await prisma.questionnaire.update({ where: { id }, data: { status: "EXPORTED" } });
  await writeAuditEvent({ actorId: user.id, action: "questionnaire.export", entityType: "questionnaire", entityId: id, metadata: { format, items: q.items.length } });

  const safeName = q.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": FORMAT_META[format].contentType,
      "Content-Disposition": `attachment; filename="questionnaire-${safeName}.${FORMAT_META[format].ext}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
