"use client";

import { useState } from "react";
import { StatusBadge, apiSend, useApi } from "@/components/ui";

type Entry = {
  id: string;
  port: string;
  protocol: string;
  service: string;
  direction: string;
  source: string;
  destination: string;
  justification: string;
  status: string;
  associatedControl: string | null;
};

const empty = {
  port: "",
  protocol: "TCP",
  service: "",
  direction: "INBOUND",
  source: "",
  destination: "",
  justification: "",
  status: "PENDING",
  associatedControl: "",
};

export function PpsmPanel({ systemId }: { systemId: string }) {
  const { data, loading, refetch } = useApi<Entry[]>(`/api/ppsm?systemId=${systemId}`);
  const [open, setOpen] = useState(false);

  async function setStatus(id: string, status: string) {
    await apiSend(`/api/ppsm/${id}`, "PATCH", { status });
    refetch();
  }
  async function remove(id: string) {
    await apiSend(`/api/ppsm/${id}`, "DELETE");
    refetch();
  }

  const unapproved = (data ?? []).filter((e) => e.status !== "APPROVED").length;

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="text-sm text-slate-400">
          {data?.length ?? 0} entries · <span className={unapproved ? "text-amber-300" : ""}>{unapproved} not approved</span>
        </div>
        <button className="btn-primary ml-auto" onClick={() => setOpen(true)}>Add entry</button>
      </div>

      {loading && <p className="text-sm text-slate-400">Loading…</p>}
      {data && data.length === 0 && <p className="text-sm text-slate-400">No PPSM entries yet.</p>}

      {data && data.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-ink-700">
          <table className="w-full">
            <thead className="bg-ink-900">
              <tr>
                <th className="th">Port / Proto</th>
                <th className="th">Service</th>
                <th className="th">Direction</th>
                <th className="th">Source → Dest</th>
                <th className="th">Control</th>
                <th className="th">Status</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {data.map((e) => (
                <tr key={e.id} className="align-top hover:bg-ink-900/40">
                  <td className="td font-mono text-xs text-slate-200">{e.port}/{e.protocol}</td>
                  <td className="td">
                    <div className="text-slate-100">{e.service}</div>
                    <div className="text-xs text-slate-500">{e.justification}</div>
                  </td>
                  <td className="td text-xs text-slate-400">{e.direction}</td>
                  <td className="td text-xs text-slate-400">{[e.source, e.destination].filter(Boolean).join(" → ") || "—"}</td>
                  <td className="td text-xs text-slate-300">{e.associatedControl ?? "—"}</td>
                  <td className="td">
                    <select className="input py-1 text-xs" value={e.status} onChange={(ev) => setStatus(e.id, ev.target.value)}>
                      {["PENDING", "APPROVED", "DENIED"].map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="td text-right">
                    <button className="text-xs text-red-400 hover:underline" onClick={() => remove(e.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && <PpsmModal systemId={systemId} onClose={() => setOpen(false)} onSaved={refetch} />}
    </div>
  );
}

function PpsmModal({ systemId, onClose, onSaved }: { systemId: string; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ ...empty });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f, v: string) => setF((c) => ({ ...c, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiSend("/api/ppsm", "POST", { systemId, ...f, associatedControl: f.associatedControl || null });
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
        <h3 className="mb-4 text-lg font-semibold text-slate-100">Add PPSM entry</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Port</label>
            <input className="input" value={f.port} onChange={(e) => set("port", e.target.value)} required placeholder="443" />
          </div>
          <div>
            <label className="label">Protocol</label>
            <select className="input" value={f.protocol} onChange={(e) => set("protocol", e.target.value)}>
              {["TCP", "UDP", "ICMP", "OTHER"].map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Service</label>
            <input className="input" value={f.service} onChange={(e) => set("service", e.target.value)} required placeholder="HTTPS" />
          </div>
          <div>
            <label className="label">Direction</label>
            <select className="input" value={f.direction} onChange={(e) => set("direction", e.target.value)}>
              {["INBOUND", "OUTBOUND"].map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Associated control</label>
            <input className="input" value={f.associatedControl} onChange={(e) => set("associatedControl", e.target.value)} placeholder="SC-7" />
          </div>
          <div>
            <label className="label">Source</label>
            <input className="input" value={f.source} onChange={(e) => set("source", e.target.value)} placeholder="Internet" />
          </div>
          <div>
            <label className="label">Destination</label>
            <input className="input" value={f.destination} onChange={(e) => set("destination", e.target.value)} placeholder="Web tier" />
          </div>
          <div className="col-span-2">
            <label className="label">Business justification</label>
            <textarea className="input h-16" value={f.justification} onChange={(e) => set("justification", e.target.value)} />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={f.status} onChange={(e) => set("status", e.target.value)}>
              {["PENDING", "APPROVED", "DENIED"].map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Add entry"}</button>
        </div>
      </form>
    </div>
  );
}
