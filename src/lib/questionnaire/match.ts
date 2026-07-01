// Deterministic question-similarity matching over the answer library. Pure functions, unit-tested.

const STOP = new Set(["the", "a", "an", "is", "are", "do", "does", "you", "your", "we", "our", "to", "of", "and", "or", "for", "in", "on", "with", "how", "what", "have", "has", "any", "this", "that"]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

function termFreq(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

/** Cosine similarity (0..1) between two questions' token vectors. */
export function similarity(a: string, b: string): number {
  const ta = termFreq(tokenize(a));
  const tb = termFreq(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let dot = 0;
  for (const [term, fa] of ta) dot += fa * (tb.get(term) ?? 0);
  const mag = (m: Map<string, number>) => Math.sqrt([...m.values()].reduce((s, v) => s + v * v, 0));
  return dot / (mag(ta) * mag(tb));
}

export type LibraryCandidate = { id: string; question: string; answer: string; sourceRefs: string };

/** Rank library entries by similarity to a question; returns top-k above a floor. */
export function bestMatches(
  question: string,
  library: LibraryCandidate[],
  k = 3,
  floor = 0.1
): { candidate: LibraryCandidate; score: number }[] {
  return library
    .map((c) => ({ candidate: c, score: similarity(question, c.question) }))
    .filter((m) => m.score >= floor)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
