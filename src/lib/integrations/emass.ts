// eMASS-style POA&M export. Produces a CSV with the column layout familiar to eMASS POA&M
// uploads. Not an official template, but maps cleanly to the standard fields.

type PoamForExport = {
  poamNumber: string;
  weaknessTitle: string;
  weaknessDescription: string;
  severity: string;
  riskRating: string;
  status: string;
  source: string;
  remediationPlan: string;
  residualRisk: string;
  scheduledCompletion: Date | null;
  control: string | null;
};

const COLUMNS = [
  "POA&M ID",
  "Control Vulnerability Description",
  "Security Control Number",
  "Office/Org",
  "Security Checks",
  "Raw Severity Value",
  "Severity",
  "Relevance of Threat",
  "Likelihood",
  "Impact",
  "Residual Risk Level",
  "Source Identifying Vulnerability",
  "Status",
  "Scheduled Completion Date",
  "Milestones with Completion Dates",
  "Mitigations",
  "Comments",
];

function cell(v: string): string {
  let s = String(v ?? "");
  // Neutralize CSV/formula injection (leading =, +, -, @, or control char).
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const SEV_TO_RAW: Record<string, string> = { CRITICAL: "I", HIGH: "I", MODERATE: "II", LOW: "III", INFO: "III" };

export function buildEmassCsv(systemName: string, poams: PoamForExport[]): Buffer {
  const lines: string[] = [];
  lines.push(cell(`eMASS POA&M Export — ${systemName}`));
  lines.push(cell(`Generated ${new Date().toISOString()}`));
  lines.push("");
  lines.push(COLUMNS.map(cell).join(","));

  for (const p of poams) {
    const row = [
      p.poamNumber,
      p.weaknessTitle + (p.weaknessDescription ? ` — ${p.weaknessDescription}` : ""),
      p.control ?? "",
      "", // Office/Org (left for the team to fill)
      p.source,
      SEV_TO_RAW[p.severity] ?? "II",
      p.severity,
      "", // Relevance of Threat
      "", // Likelihood
      "", // Impact
      p.riskRating,
      p.source,
      p.status.replaceAll("_", " "),
      p.scheduledCompletion ? p.scheduledCompletion.toISOString().slice(0, 10) : "",
      "", // Milestones (exported separately)
      p.remediationPlan,
      p.residualRisk,
    ];
    lines.push(row.map((v) => cell(String(v ?? ""))).join(","));
  }

  return Buffer.from(lines.join("\n"), "utf8");
}
