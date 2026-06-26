import { aiComplete, type DraftResult } from "@/lib/ai";

const POLICY_SYSTEM =
  "You are a senior compliance analyst reviewing a policy/procedure document for a U.S. federal " +
  "authorization. Map the document to the provided control list ONLY. Be conservative: a control is " +
  "'covered' only if the text clearly satisfies its intent. Cite control IDs verbatim. Flag vague or " +
  "unenforceable language. Never claim coverage the text does not support. Output is a DRAFT for human review.";

export type PolicyControl = { controlId: string; title: string };

// Analyze a pasted/loaded policy document against a system's control set: which controls it covers,
// partially covers, or doesn't address, plus weak-language flags and the evidence still needed.
export function analyzePolicy(input: {
  systemName: string;
  frameworkLabel: string;
  controls: PolicyControl[];
  policyText: string;
}): Promise<DraftResult> {
  // Bound the prompt: cap controls and document length to stay within a sane token budget.
  const controls = input.controls.slice(0, 80);
  const text = input.policyText.slice(0, 14000);
  const controlList = controls.map((c) => `${c.controlId}: ${c.title}`).join("\n");

  const prompt =
    `System: ${input.systemName} (${input.frameworkLabel})\n\n` +
    `CONTROL LIST:\n${controlList}\n\n` +
    `POLICY DOCUMENT:\n"""\n${text}\n"""\n\n` +
    `Analyze the document against the control list and return Markdown with these sections:\n` +
    `## Covered — controls the document clearly satisfies (ID — one-line why)\n` +
    `## Partially covered — addressed but incomplete (ID — what's missing)\n` +
    `## Not addressed — relevant controls absent from the document (IDs)\n` +
    `## Weak or vague language — quote phrases that are unenforceable and suggest tighter wording\n` +
    `## Evidence still needed — artifacts an assessor would request to validate coverage\n` +
    `Reference only controls from the list and only claims supported by the document text.`;

  const stub =
    `[OFFLINE] Policy analysis needs ANTHROPIC_API_KEY. With a key, this maps the document against ` +
    `${controls.length} controls for ${input.systemName} and flags coverage gaps, vague language, and ` +
    `missing evidence. Document received: ${text.length} characters.`;

  return aiComplete({ system: POLICY_SYSTEM, messages: [{ role: "user", content: prompt }], stub, maxTokens: 1500 });
}
