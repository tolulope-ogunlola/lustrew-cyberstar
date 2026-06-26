"use client";

import { useMemo, useState } from "react";
import { StatusBadge, apiSend, useApi } from "@/components/ui";
import { RISK_LEVELS, ratingFromScore, score, type RiskRating } from "@/lib/risk";

type Risk = {
  id: string;
  riskNumber: string;
  title: string;
  description: string;
  threat: string;
  vulnerabilityNarrative: string;
  likelihood: string;
  impact: string;
  residualLikelihood: string;
  residualImpact: string;
  status: string;
  mitigationPlan: string;
  acceptanceDecision: string;
  approvalAuthority: string;
  targetDate: string | null;
  ownerId: string | null;
  relatedControl: string | null;
  owner: { name: string } | null;
  inherent: { score: number; rating: RiskRating };
  residual: { score: number; rating: RiskRating };
};

type UserLite = { id: string; name: string; role: string };
type ImplLite = { id: string; control: { controlId: string; title: string } };

const LEVEL_ABBR: Record<string, string> = {
  VERY_LOW: "VL",
  LOW: "L",
  MODERATE: "M",
  HIGH: "H",
  VERY_HIGH: "VH",
};

const RATING_CELL: Record<RiskRating, string> = {
  CRITICAL: "bg-red-600/30 text-red-200",
  HIGH: "bg-orange-500/25 text-orange-200",
  MEDIUM: "bg-yellow-500/20 text-yellow-100",
  LOW: "bg-emerald-500/15 text-emerald-200",
};

export function RisksPanel({ systemId }: { systemId: string }) {
  const { data, loading, refetch } = useApi<Risk[]>(`/api/risks?systemId=${systemId}`);
  const { data: users } = useApi<UserLite[]>("/api/users");
  const { data: impls } = useApi<ImplLite[]>(`/api/controls?systemId=${systemId}`);
  const [editing, setEditing] = useState<Risk | null>(null);
  const [creating, setCreating] = useState(false);

  const summary = useMemo(() => {
    const counts: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const r of data ?? []) counts[r.inherent.rating]++;
    return counts;
  }, [data]);

  // Cell counts keyed by `${likelihood}|${impact}` (inherent).
  const cellCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of data ?? []) {
      const k = `${r.likelihood}|${r.impact}`;
      m[k] = (m[k] || 0) + 1;
    }
    return m;
  }, [data]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="flex gap-2">
          {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as RiskRating[]).map((r) => (
            <span key={r} className="flex items-center gap-1.5">
              <StatusBadge value={r} />
              <span className="text-sm font-semibold text-slate-200">{summary[r]}</span>
            </span>
          ))}
        </div>
        <button className="btn-primary ml-auto" onClick={() => setCreating(true)}>
          New risk
        </button>
      </div>

      {/* 5×5 inherent-risk heatmap */}
      <div className="mb-6 card">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Inherent risk heatmap
        </div>
        <div className="flex gap-3">
          <div className="flex items-center">
            <span className="-rotate-90 whitespace-nowrap text-[10px] uppercase tracking-wider text-slate-500">
              Impact →
            </span>
          </div>
          <div className="flex-1">
            <div className="grid grid-cols-[auto_repeat(5,1fr)] gap-1">
              {[...RISK_LEVELS].reverse().map((impact) => (
                <RowCells
                  key={impact}
                  impact={impact}
                  cellCounts={cellCounts}
                />
              ))}
              {/* x-axis labels */}
              <div />
              {RISK_LEVELS.map((l) => (
                <div key={l} className="pt-1 text-center text-[10px] uppercase text-slate-500">
                  {LEVEL_ABBR[l]}
                </div>
              ))}
            </div>
            <div className="mt-1 text-center text-[10px] uppercase tracking-wider text-slate-500">
              Likelihood →
            </div>
          </div>
        </div>
      </div>

      {loading && <p className="text-sm text-slate-400">Loading…</p>}
      {data && data.length === 0 && <p className="text-sm text-slate-400">No risks yet.</p>}

      {data && data.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-ink-700">
          <table className="w-full">
            <thead className="bg-ink-900">
              <tr>
                <th className="th">Risk</th>
                <th className="th">Inherent</th>
                <th className="th">Residual</th>
                <th className="th">Owner</th>
                <th className="th">Status</th>
                <th className="th">Target</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {data.map((r) => (
                <tr key={r.id} className="align-top hover:bg-ink-900/40">
                  <td className="td max-w-md">
                    <div className="font-mono text-xs text-slate-500">{r.riskNumber}</div>
                    <div className="font-medium text-slate-100">{r.title}</div>
                    {r.relatedControl && (
                      <div className="text-xs text-slate-500">Control {r.relatedControl}</div>
                    )}
                  </td>
                  <td className="td">
                    <StatusBadge value={r.inherent.rating} />
                    <div className="mt-1 text-xs text-slate-500">{r.inherent.score}</div>
                  </td>
                  <td className="td">
                    <StatusBadge value={r.residual.rating} />
                    <div className="mt-1 text-xs text-slate-500">{r.residual.score}</div>
                  </td>
                  <td className="td text-xs text-slate-400">{r.owner?.name ?? "—"}</td>
                  <td className="td">
                    <StatusBadge value={r.status} />
                  </td>
                  <td className="td text-xs text-slate-400">
                    {r.targetDate ? new Date(r.targetDate).toLocaleDateString() : "—"}
                  </td>
                  <td className="td text-right">
                    <button className="text-xs text-brand-300 hover:underline" onClick={() => setEditing(r)}>
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <RiskModal
          systemId={systemId}
          risk={editing}
          users={users ?? []}
          impls={impls ?? []}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={refetch}
        />
      )}
    </div>
  );
}

function RowCells({
  impact,
  cellCounts,
}: {
  impact: string;
  cellCounts: Record<string, number>;
}) {
  return (
    <>
      <div className="flex items-center pr-1 text-[10px] uppercase text-slate-500">{LEVEL_ABBR[impact]}</div>
      {RISK_LEVELS.map((likelihood) => {
        const s = score(likelihood, impact);
        const count = cellCounts[`${likelihood}|${impact}`] || 0;
        return (
          <div
            key={likelihood}
            className={`flex h-10 items-center justify-center rounded text-sm font-semibold ${RATING_CELL[ratingFromScore(s.score)]}`}
            title={`${LEVEL_ABBR[likelihood]} × ${LEVEL_ABBR[impact]} = ${s.score} (${s.rating})`}
          >
            {count || ""}
          </div>
        );
      })}
    </>
  );
}

const STATUSES = ["OPEN", "MITIGATING", "ACCEPTED", "CLOSED"];

function RiskModal({
  systemId,
  risk,
  users,
  impls,
  onClose,
  onSaved,
}: {
  systemId: string;
  risk: Risk | null;
  users: UserLite[];
  impls: ImplLite[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    title: risk?.title ?? "",
    description: risk?.description ?? "",
    threat: risk?.threat ?? "",
    likelihood: risk?.likelihood ?? "MODERATE",
    impact: risk?.impact ?? "MODERATE",
    residualLikelihood: risk?.residualLikelihood ?? "LOW",
    residualImpact: risk?.residualImpact ?? "MODERATE",
    mitigationPlan: risk?.mitigationPlan ?? "",
    status: risk?.status ?? "OPEN",
    ownerId: risk?.ownerId ?? "",
    relatedControl: risk?.relatedControl ?? "",
    targetDate: risk?.targetDate ? risk.targetDate.slice(0, 10) : "",
    acceptanceDecision: risk?.acceptanceDecision ?? "",
    approvalAuthority: risk?.approvalAuthority ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof f, v: string) => setF((cur) => ({ ...cur, [k]: v }));
  const inherent = score(f.likelihood, f.impact);
  const residual = score(f.residualLikelihood, f.residualImpact);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const payload = {
      ...f,
      ownerId: f.ownerId || null,
      relatedControl: f.relatedControl || null,
      targetDate: f.targetDate ? new Date(f.targetDate).toISOString() : null,
    };
    try {
      if (risk) {
        await apiSend(`/api/risks/${risk.id}`, "PATCH", payload);
      } else {
        await apiSend("/api/risks", "POST", { systemId, ...payload });
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setBusy(false);
    }
  }

  function LevelSelect({ k, label }: { k: keyof typeof f; label: string }) {
    return (
      <div>
        <label className="label">{label}</label>
        <select className="input" value={f[k]} onChange={(e) => set(k, e.target.value)}>
          {RISK_LEVELS.map((l) => (
            <option key={l} value={l}>
              {l.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4">
      <form onSubmit={submit} className="my-8 w-full max-w-2xl rounded-xl border border-ink-700 bg-ink-900 p-5">
        <h3 className="mb-4 text-lg font-semibold text-slate-100">
          {risk ? `Manage ${risk.riskNumber}` : "New risk"}
        </h3>
        <div className="space-y-3">
          <div>
            <label className="label">Title</label>
            <input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Threat source</label>
              <input className="input" value={f.threat} onChange={(e) => set("threat", e.target.value)} />
            </div>
            <div>
              <label className="label">Related control</label>
              <select className="input" value={f.relatedControl} onChange={(e) => set("relatedControl", e.target.value)}>
                <option value="">— none —</option>
                {impls.map((i) => (
                  <option key={i.id} value={i.control.controlId}>
                    {i.control.controlId}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input h-16" value={f.description} onChange={(e) => set("description", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4 rounded-lg border border-ink-700 p-3">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Inherent — {inherent.score} ({inherent.rating})
              </div>
              <LevelSelect k="likelihood" label="Likelihood" />
              <LevelSelect k="impact" label="Impact" />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Residual — {residual.score} ({residual.rating})
              </div>
              <LevelSelect k="residualLikelihood" label="Likelihood (after controls)" />
              <LevelSelect k="residualImpact" label="Impact (after controls)" />
            </div>
          </div>

          <div>
            <label className="label">Mitigation plan</label>
            <textarea className="input h-16" value={f.mitigationPlan} onChange={(e) => set("mitigationPlan", e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Owner</label>
              <select className="input" value={f.ownerId} onChange={(e) => set("ownerId", e.target.value)}>
                <option value="">— none —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={f.status} onChange={(e) => set("status", e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Target date</label>
              <input type="date" className="input" value={f.targetDate} onChange={(e) => set("targetDate", e.target.value)} />
            </div>
          </div>

          {f.status === "ACCEPTED" && (
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <div className="col-span-2 text-xs text-amber-300">
                Formal risk acceptance — both fields are recorded on the risk.
              </div>
              <div>
                <label className="label">Approval authority</label>
                <input
                  className="input"
                  value={f.approvalAuthority}
                  onChange={(e) => set("approvalAuthority", e.target.value)}
                  placeholder="e.g. AO — Jane Doe"
                  required
                />
              </div>
              <div>
                <label className="label">Acceptance rationale</label>
                <input
                  className="input"
                  value={f.acceptanceDecision}
                  onChange={(e) => set("acceptanceDecision", e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={busy}>
            {busy ? "Saving…" : risk ? "Save risk" : "Create risk"}
          </button>
        </div>
      </form>
    </div>
  );
}
