import ExcelJS from "exceljs";

export type ImportedItem = { rowIndex: number; section: string; question: string };

const QUESTION_HEADERS = ["question", "questions", "requirement", "control", "query", "item"];
const SECTION_HEADERS = ["section", "category", "domain", "area", "topic"];

function pickColumn(headers: string[], wanted: string[]): number {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const w of wanted) {
    const i = lower.findIndex((h) => h.includes(w));
    if (i >= 0) return i;
  }
  return -1;
}

function fromRows(rows: string[][]): ImportedItem[] {
  if (rows.length === 0) return [];
  const header = rows[0];
  const qCol = pickColumn(header, QUESTION_HEADERS);
  const sCol = pickColumn(header, SECTION_HEADERS);

  // If a question column header was found, treat row 0 as headers; otherwise treat every row's
  // first column as the question.
  const hasHeader = qCol >= 0;
  const body = hasHeader ? rows.slice(1) : rows;
  const questionIdx = hasHeader ? qCol : 0;
  const sectionIdx = hasHeader ? sCol : -1;

  const items: ImportedItem[] = [];
  let idx = 0;
  for (const row of body) {
    const question = (row[questionIdx] ?? "").trim();
    if (!question) continue;
    items.push({ rowIndex: idx++, section: sectionIdx >= 0 ? (row[sectionIdx] ?? "").trim() : "", question });
  }
  return items;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "", row: string[] = [], inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c === "\r") { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export async function parseQuestionnaire(bytes: Buffer, fileName: string): Promise<ImportedItem[]> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) {
    return fromRows(parseCsv(bytes.toString("utf8")));
  }
  // XLSX via exceljs (already a dependency).
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const rows: string[][] = [];
  ws.eachRow((row) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    rows.push(values.map((v) => (v == null ? "" : String((v as { text?: string }).text ?? v))));
  });
  return fromRows(rows);
}
