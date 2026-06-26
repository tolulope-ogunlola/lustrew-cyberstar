"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { StatusBadge, useApi } from "@/components/ui";
import { AiDraftPanel } from "@/components/AiDraftPanel";
import { GettingStarted } from "@/components/GettingStarted";
import { TrendChart } from "@/components/TrendChart";
import { Icon, type IconName } from "@/components/icons";

type Snapshot = { day: string; readinessScore: number; posturePercent: number; openPoams: number; openVulnCritical: number; openVulnHigh: number };

function TrendSection({ systemId }: { systemId: string }) {
  const { data } = useApi<Snapshot[]>(`/api/metrics/history?systemId=${systemId}&days=30`);
  if (!data) return null;
  return (
    <div className="mt-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Trends (last 30 days)</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TrendChart label="ATO readiness" suffix="" points={data.map((d) => d.readinessScore)} />
        <TrendChart label="Control posture" suffix="%" points={data.map((d) => d.posturePercent)} color="rgb(var(--accent-500))" />
        <TrendChart label="Open POA&Ms" points={data.map((d) => d.openPoams)} color="rgb(248 113 113)" />
      </div>
    </div>
  );
}

type SystemRow = { id: string; name: string; fipsCategory: string };

type DashData = {
  system: { id: string; name: string; fipsCategory: string; frameworks: string[] };
  score: {
    posturePercent: number;
    readinessScore: number;
    controlsTotal: number;
    controlsApplicable: number;
    byStatus: Record<string, number>;
    evidenceCompletePercent: number;
    rmfProgressPercent: number;
    openPoams: number;
    overduePoams: number;
  };
  needsAttention: number;
  missingEvidence: number;
  vulns: { open: number; critical: number; high: number };
  risks: { open: number; highOrCritical: number };
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function KpiCard({
  icon,
  tint,
  value,
  label,
  secondary,
}: {
  icon: IconName;
  tint: string;
  value: string;
  label: string;
  secondary: string;
}) {
  return (
    <div className="kpi-card">
      <div className={`icon-tile ${tint}`}>
        <Icon name={icon} className="h-5 w-5" />
      </div>
      <div className="mt-4 text-3xl font-bold text-slate-100">{value}</div>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-sm text-slate-400">{label}</span>
        <span className="text-xs text-slate-500">{secondary}</span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const { data: systems } = useApi<SystemRow[]>("/api/systems");
  const [systemId, setSystemId] = useState<string | null>(null);
  const [showAi, setShowAi] = useState(false);

  useEffect(() => {
    if (systems && systems.length && !systemId) setSystemId(systems[0].id);
  }, [systems, systemId]);

  const { data, loading } = useApi<DashData>(systemId ? `/api/dashboard/${systemId}` : null);

  const healthy = data ? data.score.overduePoams === 0 : true;
  const name = session?.user?.name ?? "there";

  return (
    <div>
      {/* Greeting + health pill */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">
            {greeting()}, {name}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {session?.user?.email} · Continuous monitoring snapshot
          </p>
        </div>
        {data && (
          <span
            className={`pill ${
              healthy
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-amber-500/30 bg-amber-500/10 text-amber-300"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${healthy ? "bg-emerald-400" : "bg-amber-400"}`} />
            {healthy ? "On track" : "Attention needed"}
          </span>
        )}
      </div>

      <GettingStarted />

      {/* System selector */}
      <div className="mb-6 flex flex-wrap gap-2">
        {(systems ?? []).map((s) => (
          <button
            key={s.id}
            onClick={() => setSystemId(s.id)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition ${
              s.id === systemId
                ? "border-brand-500 bg-brand-600/15 text-brand-300"
                : "border-ink-700 text-slate-300 hover:bg-ink-800"
            }`}
          >
            {s.name}
            <span className="ml-2 text-xs text-slate-500">{s.fipsCategory}</span>
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-slate-400">Loading…</p>}

      {data && (
        <>
          {/* KPI tiles */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              icon="target"
              tint="bg-sky-500/15 text-sky-300"
              value={`${data.score.readinessScore}`}
              label="ATO Readiness"
              secondary="/ 100"
            />
            <KpiCard
              icon="shield"
              tint="bg-emerald-500/15 text-emerald-300"
              value={`${data.score.posturePercent}%`}
              label="Control Posture"
              secondary={`${data.score.controlsApplicable} applicable`}
            />
            <KpiCard
              icon="clock"
              tint="bg-violet-500/15 text-violet-300"
              value={`${data.score.rmfProgressPercent}%`}
              label="RMF Progress"
              secondary={`evidence ${data.score.evidenceCompletePercent}%`}
            />
            <KpiCard
              icon="flag"
              tint="bg-amber-500/15 text-amber-300"
              value={`${data.score.openPoams}`}
              label="Open POA&Ms"
              secondary={`${data.score.overduePoams} overdue`}
            />
          </div>

          {/* Info strip */}
          <div className="mt-4 flex flex-wrap items-center gap-x-10 gap-y-3 rounded-2xl border border-ink-800 bg-ink-900/60 px-5 py-4">
            <InfoStat icon="shield" label="Controls" value={`${data.score.controlsTotal} total · ${data.score.controlsApplicable} applicable`} />
            <InfoStat icon="folder" label="Missing evidence" value={`${data.missingEvidence}`} warn={data.missingEvidence > 0} />
            <InfoStat
              icon="alert"
              label="Open vulnerabilities"
              value={`${data.vulns.open} (${data.vulns.critical} crit · ${data.vulns.high} high)`}
              warn={data.vulns.critical > 0}
            />
            <InfoStat
              icon="scale"
              label="Open risks"
              value={`${data.risks.open} (${data.risks.highOrCritical} high/critical)`}
              warn={data.risks.highOrCritical > 0}
            />
            <InfoStat icon="flag" label="Needs attention" value={`${data.needsAttention} controls`} />
            <Link href={`/systems/${data.system.id}`} className="ml-auto text-sm font-medium text-brand-300 hover:underline">
              Open workspace →
            </Link>
          </div>

          {/* Controls by status */}
          <div className="mt-6 card">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Controls by status
            </h2>
            <div className="flex flex-wrap gap-3">
              {Object.entries(data.score.byStatus).map(([status, count]) => (
                <div key={status} className="flex items-center gap-2 rounded-lg border border-ink-800 px-3 py-2">
                  <StatusBadge value={status} />
                  <span className="text-sm font-semibold text-slate-200">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Secondary stat row */}
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <SmallStat icon="trend" value={`${data.score.posturePercent}%`} label="Implemented posture" />
            <SmallStat icon="target" value={`${data.score.readinessScore}/100`} label="Readiness score" />
            <SmallStat icon="folder" value={`${data.score.evidenceCompletePercent}%`} label="Evidence complete" />
            <SmallStat icon="alert" value={`${data.score.overduePoams}`} label="Overdue POA&Ms" warn={data.score.overduePoams > 0} />
          </div>

          {systemId && <TrendSection systemId={systemId} />}

          <div className="mt-6">
            <button className="btn-ghost" onClick={() => setShowAi(true)}>
              <Icon name="bolt" className="h-4 w-4" /> AI executive summary
            </button>
          </div>
        </>
      )}

      {showAi && systemId && (
        <AiDraftPanel kind="executive_summary" systemId={systemId} onClose={() => setShowAi(false)} />
      )}
    </div>
  );
}

function InfoStat({
  icon,
  label,
  value,
  warn,
}: {
  icon: IconName;
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${warn ? "bg-amber-500/15 text-amber-300" : "bg-ink-800 text-slate-400"}`}>
        <Icon name={icon} className="h-[18px] w-[18px]" />
      </span>
      <div className="leading-tight">
        <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
        <div className="text-sm font-semibold text-slate-200">{value}</div>
      </div>
    </div>
  );
}

function SmallStat({
  icon,
  value,
  label,
  warn,
}: {
  icon: IconName;
  value: string;
  label: string;
  warn?: boolean;
}) {
  return (
    <div className="stat-card flex items-center gap-3">
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${warn ? "bg-amber-500/15 text-amber-300" : "bg-ink-800 text-slate-400"}`}>
        <Icon name={icon} className="h-[18px] w-[18px]" />
      </span>
      <div className="leading-tight">
        <div className="text-lg font-bold text-slate-100">{value}</div>
        <div className="text-[11px] text-slate-500">{label}</div>
      </div>
    </div>
  );
}
