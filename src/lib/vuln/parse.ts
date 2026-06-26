import { XMLParser } from "fast-xml-parser";

export type ParsedVuln = {
  pluginId?: string;
  cve?: string;
  title: string;
  description?: string;
  solution?: string;
  severity?: string; // raw label or numeric string
  cvss?: number;
  host?: string;
  port?: string;
};

export type ParseResult = {
  source: "Nessus" | "CSV";
  findings: ParsedVuln[];
};

// --- CSV ---------------------------------------------------------------------

// RFC-4180-ish parser: handles quoted fields, escaped quotes, and newlines inside quotes.
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r") {
      // ignore
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

const ALIASES: Record<keyof ParsedVuln, string[]> = {
  pluginId: ["plugin id", "pluginid", "plugin", "plugin_id"],
  cve: ["cve", "cve id", "cves"],
  title: ["name", "plugin name", "title", "vulnerability", "finding"],
  description: ["description", "synopsis", "summary"],
  solution: ["solution", "remediation", "steps to remediate", "fix"],
  severity: ["severity", "risk", "risk factor", "criticality"],
  cvss: ["cvss v3.0 base score", "cvss3 base score", "cvssv3", "cvss base score", "cvss", "cvss2 base score"],
  host: ["host", "ip", "ip address", "asset", "dns name", "host ip"],
  port: ["port"],
};

function buildColumnMap(header: string[]): Partial<Record<keyof ParsedVuln, number>> {
  const lower = header.map((h) => h.trim().toLowerCase());
  const map: Partial<Record<keyof ParsedVuln, number>> = {};
  for (const key of Object.keys(ALIASES) as (keyof ParsedVuln)[]) {
    for (const alias of ALIASES[key]) {
      const idx = lower.indexOf(alias);
      if (idx !== -1) {
        map[key] = idx;
        break;
      }
    }
  }
  return map;
}

export function parseCsv(text: string): ParsedVuln[] {
  const rows = parseCsvRows(text);
  if (rows.length < 2) return [];
  const map = buildColumnMap(rows[0]);
  if (map.title === undefined) {
    throw new Error("CSV missing a recognizable finding name/title column");
  }

  const out: ParsedVuln[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const get = (k: keyof ParsedVuln) => (map[k] !== undefined ? (row[map[k]!] ?? "").trim() : "");
    const title = get("title");
    if (!title) continue;
    const cvssRaw = get("cvss");
    const cvss = cvssRaw ? Number(cvssRaw) : undefined;
    out.push({
      pluginId: get("pluginId") || undefined,
      cve: get("cve") || undefined,
      title,
      description: get("description") || undefined,
      solution: get("solution") || undefined,
      severity: get("severity") || undefined,
      cvss: cvss != null && !Number.isNaN(cvss) ? cvss : undefined,
      host: get("host") || undefined,
      port: get("port") || undefined,
    });
  }
  return out;
}

// --- Nessus (.nessus XML) ----------------------------------------------------

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function firstString(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (Array.isArray(v)) return v.length ? String(v[0]) : undefined;
  return String(v);
}

export function parseNessus(xml: string): ParsedVuln[] {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", parseTagValue: true });
  const doc = parser.parse(xml);
  const report = doc?.NessusClientData_v2?.Report;
  if (!report) throw new Error("Not a recognizable .nessus file (missing NessusClientData_v2/Report)");

  const out: ParsedVuln[] = [];
  for (const host of asArray(report.ReportHost)) {
    const hostName = host?.["@_name"] ? String(host["@_name"]) : undefined;
    for (const item of asArray<Record<string, unknown>>(host?.ReportItem)) {
      const title = firstString(item["@_pluginName"]) || firstString(item.synopsis) || "Unnamed finding";
      const cvss3 = firstString(item.cvss3_base_score);
      const cvss2 = firstString(item.cvss_base_score);
      const cvss = cvss3 ?? cvss2;
      out.push({
        pluginId: firstString(item["@_pluginID"]),
        cve: firstString(item.cve),
        title,
        description: firstString(item.description),
        solution: firstString(item.solution),
        severity: firstString(item["@_severity"]),
        cvss: cvss ? Number(cvss) : undefined,
        host: hostName,
        port: firstString(item["@_port"]),
      });
    }
  }
  return out;
}

/** Dispatch on file content/name. */
export function parseScan(fileName: string, content: string): ParseResult {
  const looksXml = content.trimStart().startsWith("<") || /\.nessus$|\.xml$/i.test(fileName);
  if (looksXml) {
    return { source: "Nessus", findings: parseNessus(content) };
  }
  return { source: "CSV", findings: parseCsv(content) };
}
