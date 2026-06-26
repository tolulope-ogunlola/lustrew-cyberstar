"use client";

import { useState } from "react";
import { PageHeader, StatusBadge, apiSend, useApi } from "@/components/ui";
import { FRAMEWORKS, POLICY_STATUS } from "@/lib/validation";

type Policy = {
  id: string;
  title: string;
  framework: string;
  version: string;
  status: string;
  url: string;
  reviewDate: string | null;
  ackCount: number;
  acknowledgedByMe: boolean;
};

export default function PoliciesPage() {
  const { data, loading, refetch } = useApi<Policy[]>("/api/policies");
  const [open, setOpen] = useState(false);

  async function acknowledge(id: string) {
    await apiSend(`/api/policies/${id}/ack`, "POST");
    refetch();
  }
  async function setStatus(id: string, status: string) {
    await apiSend(`/api/policies/${id}`, "PATCH", { status });
    refetch();
  }

  return (
    <div>
      <PageHeader
        title="Policies & Governance"
        subtitle="Cybersecurity policies, review status, and acknowledgements"
        actions={<button className="btn-primary" onClick={() => setOpen(true)}>New policy</button>}
      />

      {loading && <p className="text-sm text-slate-400">Loading…</p>}

      <div className="grid gap-3 md:grid-cols-2">
        {(data ?? []).map((p) => (
          <div key={p.id} className="card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-slate-100">{p.title}</div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {p.framework.replaceAll("_", " ")} · v{p.version}
                  {p.reviewDate && ` · review ${new Date(p.reviewDate).toLocaleDateString()}`}
                </div>
              </div>
              <StatusBadge value={p.status} />
            </div>
            {p.url && (
              <a href={p.url} target="_blank" className="mt-2 block text-xs text-brand-300 hover:underline">{p.url}</a>
            )}
            <div className="mt-3 flex items-center gap-3">
              <select className="input max-w-[160px] py-1 text-xs" value={p.status} onChange={(e) => setStatus(p.id, e.target.value)}>
                {POLICY_STATUS.map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}
              </select>
              <span className="text-xs text-slate-500">{p.ackCount} acknowledged</span>
              {p.acknowledgedByMe ? (
                <span className="badge bg-emerald-500/15 text-emerald-300">You acknowledged ✓</span>
              ) : (
                <button className="btn-ghost py-1 text-xs" onClick={() => acknowledge(p.id)}>Acknowledge</button>
              )}
            </div>
          </div>
        ))}
        {data && data.length === 0 && <p className="text-sm text-slate-400">No policies yet.</p>}
      </div>

      {open && <PolicyModal onClose={() => setOpen(false)} onSaved={refetch} />}
    </div>
  );
}

function PolicyModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ title: "", framework: "NIST_RMF", version: "1.0", status: "DRAFT", url: "", reviewDate: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f, v: string) => setF((c) => ({ ...c, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiSend("/api/policies", "POST", {
        ...f,
        reviewDate: f.reviewDate ? new Date(f.reviewDate).toISOString() : null,
      });
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
        <h3 className="mb-4 text-lg font-semibold text-slate-100">New policy</h3>
        <div className="space-y-3">
          <div>
            <label className="label">Title</label>
            <input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} required />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Framework</label>
              <select className="input" value={f.framework} onChange={(e) => set("framework", e.target.value)}>
                {FRAMEWORKS.map((fr) => <option key={fr} value={fr}>{fr.replaceAll("_", " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Version</label>
              <input className="input" value={f.version} onChange={(e) => set("version", e.target.value)} />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={f.status} onChange={(e) => set("status", e.target.value)}>
                {POLICY_STATUS.map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Document URL</label>
            <input className="input" value={f.url} onChange={(e) => set("url", e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <label className="label">Next review date</label>
            <input type="date" className="input" value={f.reviewDate} onChange={(e) => set("reviewDate", e.target.value)} />
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Create policy"}</button>
        </div>
      </form>
    </div>
  );
}
