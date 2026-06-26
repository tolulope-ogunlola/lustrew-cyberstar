// Subscription tiers for the multi-tenant SaaS model. Pure data + helpers — unit tested.

export type PlanId = "FREE" | "PRO" | "MSP" | "ENTERPRISE";

export type Plan = {
  id: PlanId;
  label: string;
  priceLabel: string;
  maxSystems: number; // Infinity for unlimited
  blurb: string;
};

export const PLANS: Record<PlanId, Plan> = {
  FREE: { id: "FREE", label: "Starter", priceLabel: "$0", maxSystems: 1, blurb: "One system, self-assessment — try the full workflow." },
  PRO: { id: "PRO", label: "Pro", priceLabel: "$799/mo", maxSystems: 10, blurb: "CMMC/RMF readiness, POA&M automation, and evidence for a small team." },
  MSP: { id: "MSP", label: "Consultant / MSP", priceLabel: "$2,500/mo", maxSystems: 50, blurb: "Manage many client systems; monthly ConMon and assessor packets." },
  ENTERPRISE: { id: "ENTERPRISE", label: "Enterprise / Agency", priceLabel: "Contact us", maxSystems: Infinity, blurb: "Unlimited systems, SSO, and custom integrations." },
};

export const PLAN_ORDER: PlanId[] = ["FREE", "PRO", "MSP", "ENTERPRISE"];

export function getPlan(plan: string | null | undefined): Plan {
  return PLANS[(plan as PlanId) ?? "FREE"] ?? PLANS.FREE;
}

// Whether another system may be created under a plan given the current count.
export function canAddSystem(plan: string | null | undefined, currentSystems: number): boolean {
  return currentSystems < getPlan(plan).maxSystems;
}
