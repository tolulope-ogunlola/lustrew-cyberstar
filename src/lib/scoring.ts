import type { ImplementationStatus, PoamStatus, StepStatus } from "./types";

// Weight each implementation status toward a 0..1 "credit" for posture scoring.
const STATUS_CREDIT: Record<ImplementationStatus, number> = {
  IMPLEMENTED: 1,
  RISK_ACCEPTED: 1,
  PARTIALLY_IMPLEMENTED: 0.5,
  PLANNED: 0.1,
  NOT_IMPLEMENTED: 0,
};

const STEP_CREDIT: Record<StepStatus, number> = {
  COMPLETE: 1,
  IN_PROGRESS: 0.4,
  BLOCKED: 0.1,
  NOT_STARTED: 0,
};

const OPEN_POAM_STATUSES: PoamStatus[] = ["OPEN", "IN_PROGRESS", "PENDING_REVIEW"];

function creditFor<K extends string>(map: Record<K, number>, key: string): number {
  return (map as Record<string, number>)[key] ?? 0;
}

export type ImplForScore = {
  status: string;
  scoping: string;
  narrative: string;
  _evidenceCount: number;
};

export type StepForScore = { status: string };
export type PoamForScore = {
  status: string;
  scheduledCompletion: Date | null;
  actualCompletion: Date | null;
};

export type DashboardScore = {
  posturePercent: number; // 0..100, control implementation posture
  readinessScore: number; // 0..100, blended ATO readiness
  controlsTotal: number;
  controlsApplicable: number;
  byStatus: Record<ImplementationStatus, number>;
  evidenceCompletePercent: number; // applicable, implemented controls that have >=1 evidence
  rmfProgressPercent: number;
  openPoams: number;
  overduePoams: number;
};

function isApplicable(scoping: string) {
  return scoping !== "NOT_APPLICABLE";
}

export function computeScore(
  impls: ImplForScore[],
  steps: StepForScore[],
  poams: PoamForScore[],
  now: Date = new Date()
): DashboardScore {
  const byStatus: Record<ImplementationStatus, number> = {
    NOT_IMPLEMENTED: 0,
    PLANNED: 0,
    PARTIALLY_IMPLEMENTED: 0,
    IMPLEMENTED: 0,
    RISK_ACCEPTED: 0,
  };
  for (const i of impls) {
    if (i.status in byStatus) byStatus[i.status as ImplementationStatus]++;
  }

  const applicable = impls.filter((i) => isApplicable(i.scoping));
  const posture =
    applicable.length === 0
      ? 0
      : applicable.reduce((s, i) => s + creditFor(STATUS_CREDIT, i.status), 0) / applicable.length;

  // Evidence completeness: of applicable controls expected to be implemented, how many have evidence.
  const expectEvidence = applicable.filter(
    (i) => i.status === "IMPLEMENTED" || i.status === "PARTIALLY_IMPLEMENTED"
  );
  const withEvidence = expectEvidence.filter((i) => i._evidenceCount > 0);
  const evidenceComplete =
    expectEvidence.length === 0 ? 1 : withEvidence.length / expectEvidence.length;

  const rmfProgress =
    steps.length === 0
      ? 0
      : steps.reduce((s, st) => s + creditFor(STEP_CREDIT, st.status), 0) / steps.length;

  const isOpen = (status: string) => OPEN_POAM_STATUSES.includes(status as PoamStatus);
  const openPoams = poams.filter((p) => isOpen(p.status)).length;
  const overduePoams = poams.filter(
    (p) => isOpen(p.status) && p.scheduledCompletion != null && p.scheduledCompletion < now
  ).length;

  // Blended readiness: controls posture + evidence + RMF progress, penalized by overdue POA&Ms.
  // A system with no applicable controls has made no progress toward ATO — readiness is 0
  // (otherwise vacuous 100% evidence-completeness would inflate it).
  const base = 0.5 * posture + 0.2 * evidenceComplete + 0.3 * rmfProgress;
  const penalty = Math.min(0.25, overduePoams * 0.05);
  const readiness = applicable.length === 0 ? 0 : Math.max(0, base - penalty);

  return {
    posturePercent: Math.round(posture * 100),
    readinessScore: Math.round(readiness * 100),
    controlsTotal: impls.length,
    controlsApplicable: applicable.length,
    byStatus,
    evidenceCompletePercent: Math.round(evidenceComplete * 100),
    rmfProgressPercent: Math.round(rmfProgress * 100),
    openPoams,
    overduePoams,
  };
}
