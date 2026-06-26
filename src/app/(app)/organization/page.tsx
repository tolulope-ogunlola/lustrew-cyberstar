"use client";

import { useSession } from "next-auth/react";
import { PageHeader, apiSend, useApi } from "@/components/ui";
import { PLANS, PLAN_ORDER, getPlan, type PlanId } from "@/lib/plans";

type Org = {
  id: string;
  name: string;
  plan: string;
  billingEmail: string;
  createdAt: string;
  _count: { users: number; systems: number };
};

export default function OrganizationPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const { data, loading, refetch } = useApi<Org>("/api/organization");

  async function setPlan(plan: PlanId) {
    await apiSend("/api/organization", "PATCH", { plan });
    refetch();
  }

  if (loading || !data) return <p className="text-sm text-slate-400">Loading…</p>;
  const current = getPlan(data.plan);

  return (
    <div>
      <PageHeader title="Organization & Plan" subtitle="Your tenant, subscription tier, and usage" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="kpi-card">
          <div className="text-xs uppercase tracking-wide text-slate-400">Organization</div>
          <div className="mt-2 text-lg font-semibold text-slate-100">{data.name}</div>
          <div className="text-xs text-slate-500">since {data.createdAt.slice(0, 10)}</div>
        </div>
        <div className="kpi-card">
          <div className="text-xs uppercase tracking-wide text-slate-400">Current plan</div>
          <div className="mt-2 text-lg font-semibold text-brand-300">{current.label}</div>
          <div className="text-xs text-slate-500">{current.priceLabel}</div>
        </div>
        <div className="kpi-card">
          <div className="text-xs uppercase tracking-wide text-slate-400">Usage</div>
          <div className="mt-2 text-lg font-semibold text-slate-100">
            {data._count.systems}
            {current.maxSystems === Infinity ? "" : ` / ${current.maxSystems}`} systems
          </div>
          <div className="text-xs text-slate-500">{data._count.users} members</div>
        </div>
      </div>

      <h2 className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wider text-slate-400">Plans</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {PLAN_ORDER.map((id) => {
          const p = PLANS[id];
          const isCurrent = data.plan === id;
          return (
            <div key={id} className={`card flex flex-col ${isCurrent ? "border-brand-500" : ""}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-100">{p.label}</h3>
                {isCurrent && <span className="badge bg-brand-600/20 text-brand-300">Current</span>}
              </div>
              <div className="mt-1 text-2xl font-bold text-slate-100">{p.priceLabel}</div>
              <p className="mt-2 flex-1 text-sm text-slate-400">{p.blurb}</p>
              <div className="mt-2 text-xs text-slate-500">
                {p.maxSystems === Infinity ? "Unlimited systems" : `Up to ${p.maxSystems} system${p.maxSystems > 1 ? "s" : ""}`}
              </div>
              {isAdmin && !isCurrent && (
                <button className="btn-ghost mt-3 text-sm" onClick={() => setPlan(id)}>
                  {PLAN_ORDER.indexOf(id) > PLAN_ORDER.indexOf(data.plan as PlanId) ? "Upgrade" : "Switch"} to {p.label}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {!isAdmin && <p className="mt-4 text-xs text-slate-500">Only an administrator can change the plan.</p>}
      <p className="mt-4 text-xs text-slate-500">Plan changes here are self-serve for the demo; production would route through billing.</p>
    </div>
  );
}
