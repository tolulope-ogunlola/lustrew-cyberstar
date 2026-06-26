// Risk scoring on a 5×5 likelihood × impact matrix (NIST SP 800-30 style).
// Pure functions — unit tested in risk.test.ts.

export type RiskLevel = "VERY_LOW" | "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH";
export type RiskRating = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export const RISK_LEVELS: RiskLevel[] = ["VERY_LOW", "LOW", "MODERATE", "HIGH", "VERY_HIGH"];

const LEVEL_VALUE: Record<RiskLevel, number> = {
  VERY_LOW: 1,
  LOW: 2,
  MODERATE: 3,
  HIGH: 4,
  VERY_HIGH: 5,
};

export function levelValue(level: string): number {
  return LEVEL_VALUE[(level as RiskLevel)] ?? 3;
}

/** Map a 1..25 product score to a qualitative rating. */
export function ratingFromScore(score: number): RiskRating {
  if (score >= 20) return "CRITICAL";
  if (score >= 12) return "HIGH";
  if (score >= 6) return "MEDIUM";
  return "LOW";
}

export type RiskScore = { score: number; rating: RiskRating };

export function score(likelihood: string, impact: string): RiskScore {
  const s = levelValue(likelihood) * levelValue(impact);
  return { score: s, rating: ratingFromScore(s) };
}

export type RiskAssessment = {
  inherent: RiskScore;
  residual: RiskScore;
};

export function assessRisk(input: {
  likelihood: string;
  impact: string;
  residualLikelihood: string;
  residualImpact: string;
}): RiskAssessment {
  return {
    inherent: score(input.likelihood, input.impact),
    residual: score(input.residualLikelihood, input.residualImpact),
  };
}

const OPEN_STATUSES = new Set(["OPEN", "MITIGATING"]);
export function isOpenRisk(status: string): boolean {
  return OPEN_STATUSES.has(status);
}
