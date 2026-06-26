import type { SystemDossier } from "./dossier";

export type GapSeverity = "HIGH" | "MEDIUM" | "LOW";

export type Gap = {
  id: string;
  category: string;
  severity: GapSeverity;
  count: number;
  items: string[]; // human-readable examples (capped)
  recommendation: string;
};

const CAP = 12;
const isApplicable = (scoping: string) => scoping === "APPLICABLE";
const implemented = (s: string) => s === "IMPLEMENTED";

// Deterministically derive the authorization gaps for a system from its dossier. This is the
// factual backbone of the AI gap analysis — the model only narrates/prioritizes what this returns.
export function computeGaps(d: SystemDossier): Gap[] {
  const gaps: Gap[] = [];
  const applicable = d.controls.filter((c) => isApplicable(c.scoping));

  const unimplemented = applicable.filter((c) => ["NOT_IMPLEMENTED", "PLANNED"].includes(c.status));
  if (unimplemented.length) {
    gaps.push({
      id: "controls-unimplemented",
      category: "Unimplemented controls",
      severity: "HIGH",
      count: unimplemented.length,
      items: unimplemented.slice(0, CAP).map((c) => `${c.controlId} — ${c.title} (${c.status})`),
      recommendation: "Implement or formally scope out these applicable controls; each is a direct barrier to authorization.",
    });
  }

  const partial = applicable.filter((c) => c.status === "PARTIALLY_IMPLEMENTED");
  if (partial.length) {
    gaps.push({
      id: "controls-partial",
      category: "Partially implemented controls",
      severity: "MEDIUM",
      count: partial.length,
      items: partial.slice(0, CAP).map((c) => `${c.controlId} — ${c.title}`),
      recommendation: "Complete the remaining implementation details and document residual risk where full implementation is deferred.",
    });
  }

  const noEvidence = applicable.filter((c) => (implemented(c.status) || c.status === "PARTIALLY_IMPLEMENTED") && c.evidenceCount === 0);
  if (noEvidence.length) {
    gaps.push({
      id: "evidence-missing",
      category: "Implemented controls without evidence",
      severity: "MEDIUM",
      count: noEvidence.length,
      items: noEvidence.slice(0, CAP).map((c) => `${c.controlId} — ${c.title}`),
      recommendation: "Attach artifacts (configs, screenshots, procedures) so assessors can verify these controls.",
    });
  }

  const noNarrative = applicable.filter((c) => (implemented(c.status) || c.status === "PARTIALLY_IMPLEMENTED") && c.narrative.trim() === "");
  if (noNarrative.length) {
    gaps.push({
      id: "narrative-missing",
      category: "Missing SSP implementation statements",
      severity: "LOW",
      count: noNarrative.length,
      items: noNarrative.slice(0, CAP).map((c) => `${c.controlId} — ${c.title}`),
      recommendation: "Write (or AI-draft) the implementation statement for each control so the SSP is complete.",
    });
  }

  const overdue = d.poams.filter((p) => p.overdue);
  if (overdue.length) {
    gaps.push({
      id: "poams-overdue",
      category: "Overdue POA&Ms",
      severity: "HIGH",
      count: overdue.length,
      items: overdue.slice(0, CAP).map((p) => `${p.poamNumber} — ${p.title} (due ${p.scheduled})`),
      recommendation: "Remediate or re-baseline these past-due milestones; overdue POA&Ms weigh heavily on the AO's risk decision.",
    });
  }

  const critHigh = d.vulns.filter((v) => ["CRITICAL", "HIGH"].includes(v.severity));
  if (critHigh.length) {
    const crit = critHigh.filter((v) => v.severity === "CRITICAL").length;
    gaps.push({
      id: "vulns-open",
      category: "Open critical/high vulnerabilities",
      severity: crit > 0 ? "HIGH" : "MEDIUM",
      count: critHigh.length,
      items: critHigh.slice(0, CAP).map((v) => `${v.severity}: ${v.title}${v.cve ? ` (${v.cve})` : ""}`),
      recommendation: "Patch or mitigate; convert any that cannot be promptly remediated into tracked POA&Ms.",
    });
  }

  const openHighRisk = d.risks.filter((r) => ["HIGH", "CRITICAL"].includes(r.rating));
  if (openHighRisk.length) {
    gaps.push({
      id: "risks-high",
      category: "Open high/critical risks",
      severity: "HIGH",
      count: openHighRisk.length,
      items: openHighRisk.slice(0, CAP).map((r) => `${r.rating}: ${r.title} (${r.status})`),
      recommendation: "Drive treatment to reduce these to an acceptable level, or document formal risk acceptance by the AO.",
    });
  }

  const incompleteRmf = d.rmf.filter((s) => s.status !== "COMPLETE");
  if (incompleteRmf.length) {
    gaps.push({
      id: "rmf-incomplete",
      category: "Incomplete RMF steps",
      severity: "LOW",
      count: incompleteRmf.length,
      items: incompleteRmf.map((s) => `${s.step} (${s.status})`),
      recommendation: "Advance the RMF lifecycle; an authorization package requires all steps through AUTHORIZE.",
    });
  }

  const order: Record<GapSeverity, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return gaps.sort((a, b) => order[a.severity] - order[b.severity]);
}
