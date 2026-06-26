import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import type { ReportTable } from "./data";

export type ReportFormat = "csv" | "xlsx" | "pdf";

export const FORMAT_META: Record<ReportFormat, { ext: string; contentType: string }> = {
  csv: { ext: "csv", contentType: "text/csv; charset=utf-8" },
  xlsx: { ext: "xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  pdf: { ext: "pdf", contentType: "application/pdf" },
};

// --- CSV ----------------------------------------------------------------------

function csvCell(v: string | number): string {
  let s = String(v ?? "");
  // Neutralize CSV/formula injection: a leading =, +, -, @, or control char can execute in Excel.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(report: ReportTable): Buffer {
  const lines: string[] = [];
  lines.push(csvCell(report.title));
  lines.push(`System,${csvCell(report.system)}`);
  lines.push(`Generated,${csvCell(report.generatedAt)}`);
  if (report.summary?.length) {
    lines.push("");
    for (const s of report.summary) lines.push(`${csvCell(s.label)},${csvCell(s.value)}`);
  }
  lines.push("");
  lines.push(report.columns.map((c) => csvCell(c.label)).join(","));
  for (const row of report.rows) {
    lines.push(report.columns.map((c) => csvCell(row[c.key] ?? "")).join(","));
  }
  return Buffer.from(lines.join("\n"), "utf8");
}

// --- XLSX ---------------------------------------------------------------------

export async function toXlsx(report: ReportTable): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Lustrew CyberStar";
  wb.created = new Date();
  const ws = wb.addWorksheet("Report");

  ws.addRow([report.title]);
  ws.getRow(1).font = { bold: true, size: 14 };
  ws.addRow([`System: ${report.system}`]);
  ws.addRow([`Generated: ${report.generatedAt}`]);

  if (report.summary?.length) {
    ws.addRow([]);
    for (const s of report.summary) {
      const r = ws.addRow([s.label, s.value]);
      r.getCell(1).font = { bold: true };
    }
  }

  ws.addRow([]);
  const header = ws.addRow(report.columns.map((c) => c.label));
  header.font = { bold: true };
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2940" } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  });
  ws.columns.forEach((col, i) => {
    col.width = report.columns[i]?.width ?? 18;
  });

  for (const row of report.rows) {
    ws.addRow(report.columns.map((c) => row[c.key] ?? ""));
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

// --- PDF ----------------------------------------------------------------------

function pdfToBuffer(build: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    build(doc);
    doc.end();
  });
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, Math.max(1, maxChars - 1)) + "…";
}

export function toPdf(report: ReportTable): Promise<Buffer> {
  return pdfToBuffer((doc) => {
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const usable = right - left;
    const bottom = doc.page.height - doc.page.margins.bottom;

    // Header
    doc.fillColor("#0f1525").rect(left, 36, usable, 4).fill();
    doc.fillColor("#111").font("Helvetica-Bold").fontSize(16).text(report.title, left, 48);
    doc.font("Helvetica").fontSize(9).fillColor("#555");
    doc.text(`System: ${report.system}    Generated: ${new Date(report.generatedAt).toUTCString()}`, left);
    doc.moveDown(0.5);

    // Summary block
    if (report.summary?.length) {
      doc.moveDown(0.5);
      for (const s of report.summary) {
        doc.font("Helvetica-Bold").fontSize(9).fillColor("#222").text(`${s.label}: `, { continued: true });
        doc.font("Helvetica").fillColor("#000").text(s.value);
      }
      doc.moveDown(0.5);
    }

    // Table column geometry
    const totalWeight = report.columns.reduce((s, c) => s + (c.width ?? 12), 0);
    const xs: number[] = [];
    const widths: number[] = [];
    let x = left;
    for (const c of report.columns) {
      const w = (usable * (c.width ?? 12)) / totalWeight;
      xs.push(x);
      widths.push(w);
      x += w;
    }
    const lineHeight = 14;

    const drawHeader = (y: number) => {
      doc.fillColor("#1f2940").rect(left, y - 2, usable, lineHeight).fill();
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#fff");
      report.columns.forEach((c, i) => {
        doc.text(truncate(c.label, Math.floor(widths[i] / 4.4)), xs[i] + 2, y + 1, { width: widths[i] - 4, lineBreak: false });
      });
      return y + lineHeight;
    };

    let y = doc.y + 4;
    y = drawHeader(y);
    doc.font("Helvetica").fontSize(8).fillColor("#111");

    report.rows.forEach((row, idx) => {
      if (y + lineHeight > bottom) {
        doc.addPage();
        y = doc.page.margins.top;
        y = drawHeader(y);
        doc.font("Helvetica").fontSize(8).fillColor("#111");
      }
      if (idx % 2 === 1) {
        doc.fillColor("#f2f4f8").rect(left, y - 1, usable, lineHeight).fill();
        doc.fillColor("#111");
      }
      report.columns.forEach((c, i) => {
        const val = String(row[c.key] ?? "");
        doc.text(truncate(val, Math.floor(widths[i] / 4.0)), xs[i] + 2, y + 1, { width: widths[i] - 4, lineBreak: false });
      });
      y += lineHeight;
    });

    doc.font("Helvetica").fontSize(7).fillColor("#999");
    doc.text(`${report.rows.length} rows · Lustrew CyberStar`, left, bottom + 6);
  });
}

export async function renderReport(report: ReportTable, format: ReportFormat): Promise<Buffer> {
  if (format === "csv") return toCsv(report);
  if (format === "xlsx") return toXlsx(report);
  return toPdf(report);
}
