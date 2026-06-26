import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

export type DraftResult = {
  text: string;
  isDraft: true;
  source: "claude" | "stub";
  notice?: string;
};

function client(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}

const SYSTEM_PROMPT =
  "You are a senior ATO/A&A and RMF compliance analyst assisting a U.S. federal authorization team. " +
  "Write precise, audit-ready language grounded only in the facts provided. Do not invent evidence, " +
  "control identifiers, dates, or assessment results. Output is a DRAFT for human review and must never " +
  "be presented as a final authorization decision.";

export type ChatMessage = { role: "user" | "assistant"; content: string };

/**
 * Low-level completion used by every AI feature. When no API key is configured (or the call
 * fails) it returns the provided `stub` so the product stays fully usable offline. `system`
 * defaults to the compliance-analyst guardrail prompt.
 */
export async function aiComplete(opts: {
  messages: ChatMessage[];
  stub: string;
  system?: string;
  maxTokens?: number;
}): Promise<DraftResult> {
  const anthropic = client();
  if (!anthropic) {
    return {
      text: opts.stub,
      isDraft: true,
      source: "stub",
      notice:
        "ANTHROPIC_API_KEY is not set — this is a templated placeholder, not Claude output. Set the key to enable AI features.",
    };
  }
  try {
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 1200,
      system: opts.system ?? SYSTEM_PROMPT,
      messages: opts.messages,
    });
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return { text: text || opts.stub, isDraft: true, source: "claude" };
  } catch (err) {
    console.error("AI request failed", err);
    return {
      text: opts.stub,
      isDraft: true,
      source: "stub",
      notice: "Claude request failed — showing a templated placeholder. Check the API key and try again.",
    };
  }
}

function generate(prompt: string, stub: string): Promise<DraftResult> {
  return aiComplete({ messages: [{ role: "user", content: prompt }], stub });
}

export function draftControlNarrative(input: {
  systemName: string;
  fipsCategory: string;
  controlId: string;
  controlTitle: string;
  controlText: string;
  status: string;
  evidenceTitles: string[];
}): Promise<DraftResult> {
  const evidence = input.evidenceTitles.length
    ? input.evidenceTitles.join("; ")
    : "none linked yet";
  const prompt =
    `Draft a System Security Plan (SSP) control implementation statement.\n\n` +
    `System: ${input.systemName} (FIPS ${input.fipsCategory})\n` +
    `Control: ${input.controlId} — ${input.controlTitle}\n` +
    `Control requirement: ${input.controlText}\n` +
    `Current implementation status: ${input.status}\n` +
    `Linked evidence: ${evidence}\n\n` +
    `Write 1–2 paragraphs describing how the system implements this control. ` +
    `Reference only the linked evidence. If status is partial or not implemented, state the gap plainly.`;
  const stub =
    `[DRAFT — ${input.controlId} ${input.controlTitle}] The ${input.systemName} system addresses ` +
    `${input.controlId} at a ${input.fipsCategory} categorization. Current status: ${input.status}. ` +
    `Implementation is supported by the following evidence: ${evidence}. ` +
    `Reviewer: replace this placeholder with the validated implementation description.`;
  return generate(prompt, stub);
}

export function draftPoamDescription(input: {
  weaknessTitle: string;
  severity: string;
  source: string;
  relatedControl?: string | null;
  systemName: string;
}): Promise<DraftResult> {
  const prompt =
    `Draft a POA&M weakness description and a short remediation plan with milestones.\n\n` +
    `System: ${input.systemName}\n` +
    `Weakness: ${input.weaknessTitle}\n` +
    `Severity: ${input.severity}\n` +
    `Source: ${input.source}\n` +
    `Related control: ${input.relatedControl ?? "n/a"}\n\n` +
    `Provide: (1) a concise weakness description, (2) a 3–4 step remediation plan with suggested ` +
    `milestone timing appropriate to the severity.`;
  const stub =
    `[DRAFT POA&M] Weakness: ${input.weaknessTitle} (severity ${input.severity}, source ${input.source}). ` +
    `Related control: ${input.relatedControl ?? "n/a"}. Remediation: (1) confirm and scope the finding, ` +
    `(2) develop the corrective action, (3) implement and test, (4) validate and submit closure evidence.`;
  return generate(prompt, stub);
}

export function draftExecutiveSummary(input: {
  systemName: string;
  readinessScore: number;
  posturePercent: number;
  openPoams: number;
  overduePoams: number;
  rmfProgressPercent: number;
}): Promise<DraftResult> {
  const prompt =
    `Write a 1-paragraph executive cybersecurity posture summary for leadership.\n\n` +
    `System: ${input.systemName}\n` +
    `ATO readiness score: ${input.readinessScore}/100\n` +
    `Control posture: ${input.posturePercent}%\n` +
    `RMF progress: ${input.rmfProgressPercent}%\n` +
    `Open POA&Ms: ${input.openPoams} (overdue: ${input.overduePoams})\n\n` +
    `Plain English. Lead with the headline, then key risks and the next action to advance authorization.`;
  const stub =
    `[DRAFT] ${input.systemName} is at ${input.readinessScore}/100 ATO readiness with ${input.posturePercent}% ` +
    `control posture and ${input.rmfProgressPercent}% RMF progress. There are ${input.openPoams} open POA&Ms ` +
    `(${input.overduePoams} overdue). Priority: resolve overdue items and close evidence gaps to advance authorization.`;
  return generate(prompt, stub);
}
