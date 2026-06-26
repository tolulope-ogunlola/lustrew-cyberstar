import { aiComplete, type ChatMessage, type DraftResult } from "@/lib/ai";
import type { SystemDossier } from "./dossier";
import { computeGaps, type Gap } from "./gaps";

const COPILOT_SYSTEM =
  "You are the CyberStar AI Compliance Copilot, a senior ATO/A&A and RMF analyst embedded in a " +
  "U.S. federal authorization platform. Answer ONLY from the system context provided; if the context " +
  "does not contain the answer, say so and suggest where in the platform to look. Cite control IDs, " +
  "POA&M numbers, and statuses verbatim. Never invent evidence, dates, or assessment results. Be " +
  "concise and audit-minded. Everything you produce is a DRAFT for human review, never an authorization decision.";

// ---- Grounded context (RAG-lite) -----------------------------------------
// Build a compact, relevance-ranked context block from the dossier. When a query is given,
// controls are ranked by keyword overlap so the most relevant ones lead within the token budget.
export function buildContext(d: SystemDossier, query?: string): { text: string; citations: string[] } {
  const terms = (query ?? "")
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter((t) => t.length > 2);

  const scoreControl = (c: (typeof d.controls)[number]) => {
    if (!terms.length) return 0;
    const hay = `${c.controlId} ${c.family} ${c.title} ${c.text} ${c.narrative}`.toLowerCase();
    return terms.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0);
  };

  const ranked = [...d.controls].sort((a, b) => scoreControl(b) - scoreControl(a));
  const topControls = (terms.length ? ranked.filter((c) => scoreControl(c) > 0) : ranked).slice(0, 30);

  const lines: string[] = [];
  lines.push(`SYSTEM: ${d.system.name} (FIPS ${d.system.fipsCategory})`);
  lines.push(`Description: ${d.system.description || "—"}`);
  lines.push(`Frameworks: ${d.system.frameworks.join(", ") || "—"}`);
  lines.push(
    `Posture: readiness ${d.score.readinessScore}/100, controls ${d.score.posturePercent}% implemented ` +
      `(${d.score.controlsApplicable} applicable), RMF ${d.score.rmfProgressPercent}%, evidence ${d.score.evidenceCompletePercent}%, ` +
      `POA&Ms ${d.score.openPoams} open / ${d.score.overduePoams} overdue.`,
  );

  lines.push("\nCONTROLS:");
  for (const c of topControls) {
    lines.push(`- ${c.controlId} [${c.status}/${c.scoping}, ${c.evidenceCount} evidence] ${c.title}`);
  }

  if (d.poams.length) {
    lines.push("\nPOA&Ms:");
    for (const p of d.poams.slice(0, 20)) {
      lines.push(`- ${p.poamNumber} [${p.status}${p.overdue ? ", OVERDUE" : ""}, ${p.severity}] ${p.title}`);
    }
  }
  if (d.vulns.length) {
    lines.push("\nOPEN VULNERABILITIES (top):");
    for (const v of d.vulns.slice(0, 15)) lines.push(`- ${v.severity}: ${v.title}${v.cve ? ` (${v.cve})` : ""}`);
  }
  if (d.risks.length) {
    lines.push("\nOPEN RISKS:");
    for (const r of d.risks.slice(0, 15)) lines.push(`- ${r.rating}: ${r.title} (${r.status})`);
  }
  if (d.rmf.length) lines.push("\nRMF STEPS: " + d.rmf.map((s) => `${s.step}=${s.status}`).join(", "));

  const citations = [
    ...topControls.slice(0, 8).map((c) => c.controlId),
    ...d.poams.filter((p) => p.overdue).slice(0, 5).map((p) => p.poamNumber),
  ];

  return { text: lines.join("\n"), citations };
}

export async function copilotAnswer(d: SystemDossier, history: ChatMessage[], question: string): Promise<DraftResult & { citations: string[] }> {
  const { text: context, citations } = buildContext(d, question);
  const messages: ChatMessage[] = [
    ...history.slice(-8),
    { role: "user", content: `System context:\n${context}\n\nQuestion: ${question}` },
  ];
  const stub =
    `[OFFLINE] AI chat is unavailable without ANTHROPIC_API_KEY. Based on the current data for ` +
    `${d.system.name}: readiness ${d.score.readinessScore}/100, ${d.score.openPoams} open POA&Ms ` +
    `(${d.score.overduePoams} overdue), ${d.vulns.length} open vulnerabilities. Set the key to ask free-form questions.`;
  const res = await aiComplete({ system: COPILOT_SYSTEM, messages, stub, maxTokens: 1000 });
  return { ...res, citations };
}

// ---- Gap analysis ---------------------------------------------------------
export async function gapAnalysis(d: SystemDossier): Promise<{ gaps: Gap[]; narrative: DraftResult }> {
  const gaps = computeGaps(d);
  const gapText = gaps.length
    ? gaps.map((g) => `- [${g.severity}] ${g.category}: ${g.count} (e.g. ${g.items.slice(0, 3).join("; ") || "—"})`).join("\n")
    : "No gaps detected by the automated checks.";
  const prompt =
    `Summarize the authorization readiness of "${d.system.name}" (FIPS ${d.system.fipsCategory}, ` +
    `readiness ${d.score.readinessScore}/100) and prioritize the path to ATO based ONLY on these detected gaps:\n\n` +
    `${gapText}\n\nWrite: (1) a 2–3 sentence headline assessment, then (2) an ordered, specific "next steps" list. ` +
    `Reference the gap categories above; do not invent new findings.`;
  const stub =
    `[DRAFT] ${d.system.name} is at ${d.score.readinessScore}/100 readiness. ` +
    (gaps.length
      ? `Top priorities: ${gaps.filter((g) => g.severity === "HIGH").map((g) => g.category).join(", ") || gaps[0].category}. ` +
        `Address HIGH-severity gaps first, then complete evidence and SSP narratives.`
      : `No automated gaps detected — proceed to assessment and AO review.`);
  const narrative = await aiComplete({ system: COPILOT_SYSTEM, messages: [{ role: "user", content: prompt }], stub, maxTokens: 900 });
  return { gaps, narrative };
}

// ---- SSP / SAR document generation ----------------------------------------
export type DocKind = "ssp" | "sar";

export async function generateDocument(d: SystemDossier, kind: DocKind): Promise<{ markdown: string; source: DraftResult["source"]; notice?: string }> {
  // The executive narrative is AI-enriched; the structured body is assembled deterministically
  // from the dossier so the document is faithful even in offline (stub) mode.
  const exec = await execNarrative(d, kind);
  const md = kind === "ssp" ? renderSsp(d, exec.text) : renderSar(d, exec.text);
  return { markdown: md, source: exec.source, notice: exec.notice };
}

async function execNarrative(d: SystemDossier, kind: DocKind): Promise<DraftResult> {
  const label = kind === "ssp" ? "System Security Plan" : "Security Assessment Report";
  const prompt =
    `Write a 1–2 paragraph executive summary section for the ${label} of "${d.system.name}" ` +
    `(FIPS ${d.system.fipsCategory}). Posture: readiness ${d.score.readinessScore}/100, ` +
    `${d.score.posturePercent}% controls implemented, ${d.score.openPoams} open POA&Ms ` +
    `(${d.score.overduePoams} overdue), ${d.vulns.length} open vulnerabilities. ` +
    `Plain, factual, audit-ready. No invented details.`;
  const stub =
    `${d.system.name} is categorized FIPS 199 ${d.system.fipsCategory}. As of this report it is at ` +
    `${d.score.readinessScore}/100 ATO readiness with ${d.score.posturePercent}% of applicable controls implemented. ` +
    `There are ${d.score.openPoams} open POA&Ms (${d.score.overduePoams} overdue) and ${d.vulns.length} open vulnerabilities. ` +
    `This document is a generated draft for review by the ISSO and authorizing officials.`;
  return aiComplete({ messages: [{ role: "user", content: prompt }], stub, maxTokens: 700 });
}

function renderSsp(d: SystemDossier, exec: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const out: string[] = [];
  out.push(`# System Security Plan — ${d.system.name}`);
  out.push(`_Generated ${today} · DRAFT for human review_\n`);
  out.push(`## 1. System Identification`);
  out.push(`- **System name:** ${d.system.name}`);
  out.push(`- **FIPS 199 categorization:** ${d.system.fipsCategory}`);
  out.push(`- **Applicable frameworks:** ${d.system.frameworks.join(", ") || "—"}`);
  out.push(`- **Description:** ${d.system.description || "—"}\n`);
  out.push(`## 2. Executive Summary\n${exec}\n`);
  out.push(`## 3. RMF Status`);
  out.push(d.rmf.length ? d.rmf.map((s) => `- ${s.step}: **${s.status}**`).join("\n") : "_No RMF steps recorded._");
  out.push(`\n## 4. Control Implementation Summary`);
  out.push(`Applicable controls: ${d.score.controlsApplicable} · Implemented posture: ${d.score.posturePercent}%\n`);
  out.push(`## 5. Control Implementation Statements`);
  const applicable = d.controls.filter((c) => c.scoping === "APPLICABLE");
  for (const c of applicable) {
    out.push(`### ${c.controlId} — ${c.title}`);
    out.push(`**Status:** ${c.status} · **Evidence artifacts:** ${c.evidenceCount}`);
    out.push(c.narrative.trim() ? c.narrative.trim() : "_Implementation statement not yet documented._");
    out.push("");
  }
  return out.join("\n");
}

function renderSar(d: SystemDossier, exec: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const gaps = computeGaps(d);
  const out: string[] = [];
  out.push(`# Security Assessment Report — ${d.system.name}`);
  out.push(`_Generated ${today} · DRAFT for human review_\n`);
  out.push(`## 1. Executive Summary\n${exec}\n`);
  out.push(`## 2. Assessment Scope`);
  out.push(`- **System:** ${d.system.name} (FIPS ${d.system.fipsCategory})`);
  out.push(`- **Controls assessed:** ${d.score.controlsApplicable} applicable`);
  out.push(`- **Frameworks:** ${d.system.frameworks.join(", ") || "—"}\n`);

  if (d.assessment) {
    const a = d.assessment;
    out.push(`## 2a. Security Control Assessment Results`);
    out.push(`- **Assessment:** ${a.title}${a.completedAt ? ` (completed ${a.completedAt})` : ""}`);
    out.push(`- **Assessor:** ${a.assessorName || "—"}`);
    out.push(`- **Results:** ${a.satisfied} satisfied · ${a.otherThanSatisfied} other than satisfied · ${a.notApplicable} not applicable`);
    if (a.findings.length) {
      out.push(`\n**Other-than-satisfied controls:**`);
      out.push(a.findings.map((f) => `- ${f.controlId}: ${f.findings || "(no finding text)"}${f.recommendation ? ` — _rec:_ ${f.recommendation}` : ""}`).join("\n"));
    }
    out.push("");
  }

  out.push(`## 3. Findings & Gaps`);
  if (gaps.length) {
    for (const g of gaps) {
      out.push(`### ${g.category} — ${g.severity} (${g.count})`);
      out.push(g.items.map((i) => `- ${i}`).join("\n"));
      out.push(`**Recommendation:** ${g.recommendation}\n`);
    }
  } else {
    out.push("_No findings detected by automated assessment._\n");
  }
  out.push(`## 4. Open POA&Ms`);
  out.push(
    d.poams.filter((p) => !["COMPLETED", "CLOSED"].includes(p.status)).length
      ? d.poams
          .filter((p) => !["COMPLETED", "CLOSED"].includes(p.status))
          .map((p) => `- ${p.poamNumber} [${p.status}${p.overdue ? ", OVERDUE" : ""}] ${p.title}`)
          .join("\n")
      : "_None open._",
  );
  out.push(`\n## 5. Risk Summary`);
  out.push(d.risks.length ? d.risks.map((r) => `- ${r.rating}: ${r.title} (${r.status})`).join("\n") : "_No open risks recorded._");
  return out.join("\n");
}
