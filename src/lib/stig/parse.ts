import { XMLParser } from "fast-xml-parser";

export type StigSeverity = "CAT_I" | "CAT_II" | "CAT_III";
export type StigStatus = "OPEN" | "NOT_A_FINDING" | "NOT_APPLICABLE" | "NOT_REVIEWED";

export type ParsedStig = {
  vulnNum: string;
  ruleId?: string;
  ruleTitle: string;
  groupTitle?: string;
  severity: StigSeverity;
  status: StigStatus;
  findingDetails?: string;
  comments?: string;
  cci?: string;
  host?: string;
  stigName?: string;
};

function asArray<T>(v: unknown): T[] {
  if (v == null) return [];
  return (Array.isArray(v) ? v : [v]) as T[];
}

function severityFor(raw: string | undefined): StigSeverity {
  const s = (raw ?? "").toLowerCase();
  if (s === "high") return "CAT_I";
  if (s === "low") return "CAT_III";
  return "CAT_II";
}

function statusFor(raw: string | undefined): StigStatus {
  switch ((raw ?? "").trim()) {
    case "Open":
      return "OPEN";
    case "NotAFinding":
      return "NOT_A_FINDING";
    case "Not_Applicable":
      return "NOT_APPLICABLE";
    default:
      return "NOT_REVIEWED";
  }
}

// Parse a DISA STIG Viewer .ckl checklist. Each <VULN> carries a list of
// <STIG_DATA><VULN_ATTRIBUTE>key</VULN_ATTRIBUTE><ATTRIBUTE_DATA>value</ATTRIBUTE_DATA></STIG_DATA>.
export function parseCkl(xml: string): ParsedStig[] {
  const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false, trimValues: true });
  const doc = parser.parse(xml);
  const checklist = doc?.CHECKLIST;
  if (!checklist) throw new Error("Not a recognizable .ckl file (missing CHECKLIST root)");

  const host =
    checklist.ASSET?.HOST_NAME != null && String(checklist.ASSET.HOST_NAME) !== ""
      ? String(checklist.ASSET.HOST_NAME)
      : undefined;

  const out: ParsedStig[] = [];

  for (const istig of asArray<Record<string, unknown>>(checklist.STIGS?.iSTIG)) {
    // STIG title from STIG_INFO/SI_DATA (SID_NAME=title)
    let stigName = "";
    const siData = asArray<Record<string, unknown>>(
      (istig.STIG_INFO as Record<string, unknown> | undefined)?.SI_DATA
    );
    for (const si of siData) {
      if (String(si.SID_NAME) === "title") stigName = String(si.SID_DATA ?? "");
    }

    for (const vuln of asArray<Record<string, unknown>>(istig.VULN)) {
      const attrs: Record<string, string> = {};
      for (const sd of asArray<Record<string, unknown>>(vuln.STIG_DATA)) {
        const key = String(sd.VULN_ATTRIBUTE ?? "");
        const val = sd.ATTRIBUTE_DATA == null ? "" : String(sd.ATTRIBUTE_DATA);
        // CCI can repeat — accumulate.
        if (key === "CCI_REF" && attrs.CCI_REF) attrs.CCI_REF += `, ${val}`;
        else if (key) attrs[key] = val;
      }
      const vulnNum = attrs.Vuln_Num || attrs.Rule_ID || "";
      if (!vulnNum) continue;
      out.push({
        vulnNum,
        ruleId: attrs.Rule_ID || undefined,
        ruleTitle: attrs.Rule_Title || attrs.Group_Title || "Unnamed rule",
        groupTitle: attrs.Group_Title || undefined,
        severity: severityFor(attrs.Severity),
        status: statusFor(vuln.STATUS as string | undefined),
        findingDetails: (vuln.FINDING_DETAILS as string | undefined) || undefined,
        comments: (vuln.COMMENTS as string | undefined) || undefined,
        cci: attrs.CCI_REF || undefined,
        host,
        stigName,
      });
    }
  }

  return out;
}

// STIG CAT severity → POA&M severity and remediation SLA.
export function stigToPoamSeverity(sev: StigSeverity): string {
  return sev === "CAT_I" ? "HIGH" : sev === "CAT_II" ? "MODERATE" : "LOW";
}

export function stigSlaDays(sev: StigSeverity): number {
  return sev === "CAT_I" ? 30 : sev === "CAT_II" ? 90 : 180;
}

// STIG findings are configuration-hardening issues — default to CM-6 (Configuration Settings).
export function mapStigControl(): string {
  return "CM-6";
}
