"use client";

import { useEffect, useState } from "react";
import { PageHeader, apiSend, useApi } from "@/components/ui";
import { Icon } from "@/components/icons";

type SystemRow = { id: string; name: string; fipsCategory: string };

type CmmcData = {
  system: { id: string; name: string; fipsCategory: string };
  isCmmc: boolean;
  level: string | null;
  sprs: { score: number; max: number; floor: number; total: number; met: number; implementedPercent: number; notMet: { controlId: string; weight: number }[] };
  families: { code: string; name: string; total: number; met: number; crosswalk53: string[] }[];
  notMet: { controlId: string; title: string; status: string; weight: number }[];
  assetsByCategory: { category: string; count: number }[];
};

const LEVEL_LABEL: Record<string, string> = { CMMC_L1: "CMMC Level 1", CMMC_L2: "CMMC Level 2", NIST_800_171: "NIST SP 800-171" };

export default function CmmcPage() {
  const { data: systems } = useApi<SystemRow[]>("/api/systems");
  const [systemId, setSystemId] = useState("");

  useEffect(() => {
    if (systems && systems.length && !systemId) setSystemId(systems[0].id);
  }, [systems, systemId]);

  const { data, loading } = useApi<CmmcData>(systemId ? `/api/cmmc/${systemId}` : null);

  return (
    <div>
      <PageHeader title="CMMC Readiness" subtitle="NIST SP 800-171 coverage, SPRS score, and CUI asset scoping for CMMC assessment prep" />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-400">System</label>
        <select className="input max-w-xs" value={systemId} onChange={(e) => setSystemId(e.target.value)}>
          {(systems ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="text-sm text-slate-400">Loading…</p>}

      {data && !data.isCmmc && (
        <div className="card border-amber-500/30 bg-amber-500/5">
          <p className="text-sm text-slate-300">
            <span className="font-medium text-slate-100">{data.system.name}</span> isn&apos;t scoped to CMMC / 800-171. Create a system with the
            <span className="text-brand-300"> CMMC Level 1/2</span> or <span className="text-brand-300">NIST 800-171</span> framework to generate the 110 requirements and track readiness here.
          </p>
        </div>
      )}

      {data && data.isCmmc && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SprsCard sprs={data.sprs} level={data.level} />
            <div className="kpi-card">
              <div className="icon-tile bg-emerald-500/15 text-emerald-300"><Icon name="check" className="h-5 w-5" /></div>
              <div className="mt-4 text-3xl font-bold text-slate-100">{data.sprs.implementedPercent}%</div>
              <div className="mt-1 text-sm text-slate-400">Requirements implemented</div>
              <div className="text-xs text-slate-500">{data.sprs.met} of {data.sprs.total} applicable</div>
            </div>
            <div className="kpi-card">
              <div className="icon-tile bg-violet-500/15 text-violet-300"><Icon name="server" className="h-5 w-5" /></div>
              <div className="mt-4 text-3xl font-bold text-slate-100">{data.assetsByCategory.reduce((n, a) => n + a.count, 0)}</div>
              <div className="mt-1 text-sm text-slate-400">Inventoried assets</div>
              <div className="text-xs text-slate-500">{data.assetsByCategory.find((a) => a.category === "CUI")?.count ?? 0} CUI assets</div>
            </div>
          </div>

          <CoverageSection families={data.families} />
          <GapSection notMet={data.notMet} />
          <AssetSection systemId={systemId} />
        </div>
      )}
    </div>
  );
}

function SprsCard({ sprs, level }: { sprs: CmmcData["sprs"]; level: string | null }) {
  const pct = Math.max(0, Math.min(100, ((sprs.score - sprs.floor) / (sprs.max - sprs.floor)) * 100));
  const tone = sprs.score >= 88 ? "text-emerald-300" : sprs.score >= 0 ? "text-amber-300" : "text-red-400";
  return (
    <div className="kpi-card">
      <div className="flex items-center justify-between">
        <div className="icon-tile bg-sky-500/15 text-sky-300"><Icon name="target" className="h-5 w-5" /></div>
        {level && <span className="badge bg-ink-700 text-slate-300">{LEVEL_LABEL[level] ?? level}</span>}
      </div>
      <div className={`mt-4 text-3xl font-bold ${tone}`}>{sprs.score}</div>
      <div className="mt-1 text-sm text-slate-400">SPRS score (of {sprs.max})</div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
        <div className="h-full bg-brand-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-xs text-slate-500">Floor {sprs.floor} · DoD Assessment Methodology estimate</div>
    </div>
  );
}

function CoverageSection({ families }: { families: CmmcData["families"] }) {
  return (
    <div className="card">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Coverage by 800-171 family</h2>
      <div className="space-y-2">
        {families.map((f) => {
          const pct = f.total === 0 ? 0 : Math.round((f.met / f.total) * 100);
          return (
            <div key={f.code} className="flex items-center gap-3">
              <div className="w-56 shrink-0 text-sm text-slate-300">
                <span className="text-slate-500">{f.code}</span> {f.name}
              </div>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-800">
                <div className={`h-full ${pct === 100 ? "bg-emerald-500" : "bg-brand-500"}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="w-16 shrink-0 text-right text-xs text-slate-400">{f.met}/{f.total}</div>
              <div className="hidden w-24 shrink-0 text-right text-xs text-slate-500 sm:block">↔ {f.crosswalk53.join(", ")}</div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-slate-500">The ↔ column shows the related NIST 800-53 family for evidence reuse.</p>
    </div>
  );
}

function GapSection({ notMet }: { notMet: CmmcData["notMet"] }) {
  if (notMet.length === 0) return <p className="text-sm text-emerald-700 dark:text-emerald-300">All applicable 800-171 requirements are implemented. 🎉</p>;
  return (
    <div className="card">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">What blocks your assessment ({notMet.length})</h2>
      <p className="mb-3 text-xs text-slate-500">Highest SPRS point-impact first. Each unmet requirement deducts its weight from 110.</p>
      <div className="space-y-1">
        {notMet.map((g) => (
          <div key={g.controlId} className="flex items-center gap-3 rounded-lg border border-ink-800 px-3 py-2">
            <span className={`badge ${g.weight === 5 ? "bg-red-500/15 text-red-700 dark:text-red-300" : g.weight === 3 ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-sky-500/15 text-sky-700 dark:text-sky-300"}`}>
              −{g.weight}
            </span>
            <span className="text-sm font-medium text-slate-200">{g.controlId}</span>
            <span className="min-w-0 flex-1 truncate text-xs text-slate-500">{g.title}</span>
            <span className="text-xs text-slate-400">{g.status.replaceAll("_", " ")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Asset inventory -------------------------------------------------------
type Asset = { id: string; name: string; assetType: string; category: string; owner: string; location: string; description: string };

const CATEGORIES = ["CUI", "SECURITY_PROTECTION", "CONTRACTOR_RISK_MANAGED", "SPECIALIZED", "OUT_OF_SCOPE"];
const TYPES = ["Server", "Workstation", "Network", "Cloud Service", "Application", "Mobile", "Other"];
const CAT_LABEL: Record<string, string> = {
  CUI: "CUI",
  SECURITY_PROTECTION: "Security Protection",
  CONTRACTOR_RISK_MANAGED: "Contractor Risk Managed",
  SPECIALIZED: "Specialized",
  OUT_OF_SCOPE: "Out of Scope",
};

function AssetSection({ systemId }: { systemId: string }) {
  const { data, refetch } = useApi<Asset[]>(`/api/assets?systemId=${systemId}`);
  const [form, setForm] = useState({ name: "", assetType: "Server", category: "CUI" });
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await apiSend("/api/assets", "POST", { systemId, ...form });
      setForm({ name: "", assetType: "Server", category: "CUI" });
      refetch();
    } finally {
      setSaving(false);
    }
  }
  async function remove(id: string) {
    await apiSend(`/api/assets/${id}`, "DELETE");
    refetch();
  }

  return (
    <div className="card">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">CUI asset inventory & boundary scoping</h2>

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <input className="input max-w-[14rem]" placeholder="Asset name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select className="input max-w-[10rem]" value={form.assetType} onChange={(e) => setForm({ ...form, assetType: e.target.value })}>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="input max-w-[14rem]" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
        </select>
        <button className="btn-primary" onClick={add} disabled={saving || !form.name.trim()}>Add asset</button>
      </div>

      <div className="overflow-hidden rounded-xl border border-ink-700">
        <table className="w-full">
          <thead className="bg-ink-900">
            <tr>
              <th className="th">Asset</th>
              <th className="th">Type</th>
              <th className="th">Category</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800">
            {(data ?? []).map((a) => (
              <tr key={a.id}>
                <td className="td text-sm text-slate-200">{a.name}</td>
                <td className="td text-xs text-slate-400">{a.assetType}</td>
                <td className="td">
                  <span className={`badge ${a.category === "CUI" ? "bg-red-500/15 text-red-700 dark:text-red-300" : a.category === "OUT_OF_SCOPE" ? "bg-ink-700 text-slate-400" : "bg-sky-500/15 text-sky-700 dark:text-sky-300"}`}>
                    {CAT_LABEL[a.category] ?? a.category}
                  </span>
                </td>
                <td className="td text-right">
                  <button className="text-xs text-red-400 hover:underline" onClick={() => remove(a.id)}>Remove</button>
                </td>
              </tr>
            ))}
            {data && data.length === 0 && (
              <tr><td className="td text-sm text-slate-500" colSpan={4}>No assets yet. Categorize the assets that store, process, or transmit CUI to define your assessment scope.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
