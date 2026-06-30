import { aiComplete } from "@/lib/ai";
import { bestMatches, type LibraryCandidate } from "@/lib/questionnaire/match";

export type QuestionnaireDraft = {
  text: string;
  isDraft: true;
  confidence: number;
  source: "LIBRARY" | "AI";
  usedLibraryEntryId?: string;
  sourceRefs: string;
  notice?: string;
};

const HIGH_MATCH = 0.62; // above this, reuse the approved library answer verbatim.

const QUESTIONNAIRE_SYSTEM =
  "You are a security compliance analyst drafting answers to a customer security questionnaire. " +
  "Answer ONLY from the approved answer-library snippets provided. Do not invent security commitments, " +
  "certifications, or controls the snippets don't support. If the snippets don't cover the question, say " +
  "that internal input is needed. Output is a DRAFT for human approval before it is sent.";

/**
 * Draft an answer for one questionnaire item. A high-similarity library match is reused verbatim
 * (source LIBRARY, no AI call). Otherwise Claude drafts an answer grounded only on the candidate
 * snippets (source AI), with a graceful stub fallback when no API key is set.
 */
export async function draftQuestionnaireAnswer(input: {
  question: string;
  customer: string;
  library: LibraryCandidate[];
}): Promise<QuestionnaireDraft> {
  const matches = bestMatches(input.question, input.library, 3);
  const top = matches[0];

  if (top && top.score >= HIGH_MATCH) {
    return {
      text: top.candidate.answer,
      isDraft: true,
      source: "LIBRARY",
      confidence: Math.min(0.99, top.score),
      usedLibraryEntryId: top.candidate.id,
      sourceRefs: top.candidate.sourceRefs,
    };
  }

  if (!matches.length) {
    return {
      text: "No approved answer covers this question yet — internal input needed.",
      isDraft: true,
      source: "AI",
      confidence: 0,
      sourceRefs: "[]",
    };
  }

  const snippets = matches.map((m, i) => `(${i + 1}) Q: ${m.candidate.question}\n    A: ${m.candidate.answer}`).join("\n");
  const prompt =
    `Customer: ${input.customer || "(unspecified)"}\n` +
    `Questionnaire question: ${input.question}\n\n` +
    `Approved answer-library snippets you may draw from:\n${snippets}\n\n` +
    `Draft a concise, professional answer grounded only on the snippets above.`;
  const stub = `[DRAFT] ${matches[0].candidate.answer}`;
  const result = await aiComplete({ messages: [{ role: "user", content: prompt }], stub, system: QUESTIONNAIRE_SYSTEM, maxTokens: 500 });

  return {
    ...result,
    source: "AI",
    confidence: Math.min(0.6, top?.score ?? 0.3),
    sourceRefs: matches[0].candidate.sourceRefs,
  };
}
