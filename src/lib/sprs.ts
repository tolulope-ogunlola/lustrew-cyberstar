// NIST SP 800-171 DoD Assessment Methodology scoring ("SPRS score"). Pure — unit tested.
//
// Scoring: start at 110 (all requirements met) and subtract a per-requirement weight (5, 3, or 1)
// for every requirement NOT met. The score floors at -203. Weights follow the DoD Assessment
// Methodology; verify against the current official scoring template before any SPRS submission.

const FIVE_POINT = new Set<string>([
  "3.1.1", "3.1.2", "3.1.12", "3.1.13", "3.1.16", "3.1.17", "3.1.18",
  "3.4.5", "3.4.6", "3.4.7", "3.4.8",
  "3.5.1", "3.5.2", "3.5.3",
  "3.6.1", "3.6.2",
  "3.8.3",
  "3.11.2",
  "3.12.1", "3.12.2", "3.12.3",
  "3.13.1", "3.13.2", "3.13.5", "3.13.6", "3.13.15",
  "3.14.1", "3.14.2", "3.14.4", "3.14.5",
]);

const THREE_POINT = new Set<string>([
  "3.1.3", "3.1.4", "3.1.5", "3.1.6", "3.1.7", "3.1.8", "3.1.10", "3.1.11", "3.1.14", "3.1.15", "3.1.19", "3.1.20", "3.1.21", "3.1.22",
  "3.3.4", "3.3.5", "3.3.8",
  "3.4.1", "3.4.2", "3.4.3", "3.4.9",
  "3.5.4", "3.5.5", "3.5.6", "3.5.7", "3.5.8", "3.5.10", "3.5.11",
  "3.7.2", "3.7.5",
  "3.8.1", "3.8.2", "3.8.4", "3.8.5", "3.8.6", "3.8.7", "3.8.8", "3.8.9",
  "3.9.2",
  "3.10.1", "3.10.2",
  "3.11.1",
  "3.13.8", "3.13.11", "3.13.16",
  "3.14.3", "3.14.6", "3.14.7",
]);

export const SPRS_MAX = 110;
export const SPRS_FLOOR = -203;

export function weightFor(controlId: string): 1 | 3 | 5 {
  if (FIVE_POINT.has(controlId)) return 5;
  if (THREE_POINT.has(controlId)) return 3;
  return 1;
}

export type SprsResult = {
  score: number;
  max: number;
  floor: number;
  total: number; // requirements considered
  met: number;
  notMet: { controlId: string; weight: number }[];
  implementedPercent: number;
};

// `results` is one entry per applicable 800-171 requirement with whether it is fully met.
export function computeSprs(results: { controlId: string; met: boolean }[]): SprsResult {
  const notMet = results
    .filter((r) => !r.met)
    .map((r) => ({ controlId: r.controlId, weight: weightFor(r.controlId) }))
    .sort((a, b) => b.weight - a.weight);
  const deductions = notMet.reduce((sum, r) => sum + r.weight, 0);
  const score = Math.max(SPRS_FLOOR, SPRS_MAX - deductions);
  const met = results.length - notMet.length;
  return {
    score,
    max: SPRS_MAX,
    floor: SPRS_FLOOR,
    total: results.length,
    met,
    notMet,
    implementedPercent: results.length === 0 ? 0 : Math.round((met / results.length) * 100),
  };
}
