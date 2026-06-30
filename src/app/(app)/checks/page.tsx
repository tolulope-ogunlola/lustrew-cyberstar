"use client";

import { useState } from "react";
import { PageHeader, StatusBadge, apiSend, useApi } from "@/components/ui";

type Latest = { status: string; details: string; checkedAt: string; failingCount: number } | null;
type Assignment = {
  id: string;
  systemId: string;
  systemName: string;
  enabled: boolean;
  check: { key: string; title: string; providerType: string; severity: string; frequency: string; category: string };
  latest: Latest;
};
type CatalogCheck = { id: string; key: string; title: string; providerType: string; category: string; severity: string };
type SystemLite = { id: string; name: string };
type Integration = { id: string; type: string; name: string };

type ChecksData = {
  catalog: CatalogCheck[];
  assignments: Assignment[];
  systems: SystemLite[];
  integrations: Integration[];
};

export default function ChecksPage() {
  const { data, loading, refetch } = useApi<ChecksData>("/api/checks");
  const [running, setRunning] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [msg, setMsg] = useState("");

  async function runNow() {
    setRunning(true);
    setMsg("");
    try {
      const r = await apiSend<{ ran: number; passed: number; failed: number; errored: number }>("/api/checks/run", "POST");
      setMsg(`Ran ${r.ran} check(s): ${r.passed} passing, ${r.failed} failing, ${r.errored} error(s).`);
      await refetch();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Run failed");
    } finally {
      setRunning(false);
    }
  }

  const assignments = data?.assignments ?? [];
  const passing = assignments.filter((a) => a.latest?.status === "PASS").length;
  const failing = assignments.filter((a) => a.latest?.status === "FAIL").length;
  const errored = assignments.filter((a) => a.latest?.status === "ERROR").length;

  return (
    <div>
      <PageHeader
        title="Automated Checks"
        subtitle="Continuous controls monitoring — automated tests against your connected systems"
        actions={
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setAssignOpen(true)}>Assign check</button>
            <button className="btn-primary" disabled={running} onClick={runNow}>{running ? "Running…" : "Run checks now"}</button>
          </div>
        }
      />

      {msg && <p className="mb-4 text-sm text-slate-300">{msg}</p>}
      {loading && <p className="text-sm text-slate-400">Loading…</p>}

      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="card"><div className="text-xs uppercase text-slate-400">Passing</div><div className="mt-1 text-2xl font-bold text-emerald-400">{passing}</div></div>
        <div className="card"><div className="text-xs uppercase text-slate-400">Failing</div><div className="mt-1 text-2xl font-bold text-red-400">{failing}</div></div>
        <div className="card"><div className="text-xs uppercase text-slate-400">Errors</div><div className="mt-1 text-2xl font-bold text-amber-400">{errored}</div></div>
      </div>

      <div className="space-y-2">
        {assignments.map((a) => (
          <div key={a.id} className="card flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-[260px]">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-100">{a.check.title}</span>
                {a.latest ? <StatusBadge value={a.latest.status} /> : <span className="badge bg-ink-700 text-slate-400">not run</span>}
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                {a.systemName} · {a.check.providerType} · {a.check.category} · {a.check.frequency}
                {a.latest && ` · checked ${new Date(a.latest.checkedAt).toLocaleString()}`}
              </div>
              {a.latest?.details && <div className="mt-1 text-xs text-slate-400">{a.latest.details}</div>}
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={a.enabled}
                  onChange={async (e) => { await apiSend(`/api/check-assignments/${a.id}`, "PATCH", { enabled: e.target.checked }); refetch(); }}
                />
                enabled
              </label>
              <button
                className="text-xs text-red-400 hover:underline"
                onClick={async () => { await apiSend(`/api/check-assignments/${a.id}`, "DELETE"); refetch(); }}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        {data && assignments.length === 0 && (
          <p className="text-sm text-slate-400">No checks assigned yet. Use “Assign check” to wire a control test to a system and integration.</p>
        )}
      </div>

      {assignOpen && data && (
        <AssignModal data={data} onClose={() => setAssignOpen(false)} onSaved={refetch} />
      )}
    </div>
  );
}

function AssignModal({ data, onClose, onSaved }: { data: ChecksData; onClose: () => void; onSaved: () => void }) {
  const [systemId, setSystemId] = useState(data.systems[0]?.id ?? "");
  const [checkId, setCheckId] = useState("");
  const [integrationId, setIntegrationId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const selectedCheck = data.catalog.find((c) => c.id === checkId);
  const compatibleIntegrations = data.integrations.filter((i) => !selectedCheck || i.type === selectedCheck.providerType);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiSend(`/api/systems/${systemId}/checks`, "POST", { checkId, integrationId: integrationId || null });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form onSubmit={submit} className="w-full max-w-lg rounded-xl border border-ink-700 bg-ink-900 p-5">
        <h3 className="mb-4 text-lg font-semibold text-slate-100">Assign automated check</h3>
        <div className="space-y-3">
          <div>
            <label className="label">System</label>
            <select className="input" value={systemId} onChange={(e) => setSystemId(e.target.value)}>
              {data.systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Check</label>
            <select className="input" value={checkId} onChange={(e) => { setCheckId(e.target.value); setIntegrationId(""); }} required>
              <option value="">Select a check…</option>
              {data.catalog.map((c) => <option key={c.id} value={c.id}>{c.title} ({c.providerType})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Integration</label>
            <select className="input" value={integrationId} onChange={(e) => setIntegrationId(e.target.value)}>
              <option value="">{selectedCheck ? `Select a ${selectedCheck.providerType} integration…` : "Select a check first"}</option>
              {compatibleIntegrations.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">
              Need a connector? Add one under Integrations (mock mode works without credentials).
            </p>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy || !checkId}>{busy ? "Assigning…" : "Assign"}</button>
        </div>
      </form>
    </div>
  );
}
