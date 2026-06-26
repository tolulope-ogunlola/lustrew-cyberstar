"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader, StatusBadge, apiSend, useApi } from "@/components/ui";

type SystemRow = { id: string; name: string; fipsCategory: string };
type Impl = {
  id: string;
  status: string;
  scoping: string;
  _count: { evidenceLinks: number };
  control: { controlId: string; family: string; title: string };
};
type EvReq = {
  id: string;
  controlId: string;
  note: string;
  status: string;
  response: string;
  createdAt: string;
  requestedBy: { name: string } | null;
};

export default function AssessorPage() {
  const { data: systems } = useApi<SystemRow[]>("/api/systems");
  const [systemId, setSystemId] = useState("");

  useEffect(() => {
    if (systems && systems.length && !systemId) setSystemId(systems[0].id);
  }, [systems, systemId]);

  return (
    <div>
      <PageHeader title="Assessor Packet" subtitle="Read-only control review with an evidence-request workflow for assessors" />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-400">System</label>
        <select className="input max-w-xs" value={systemId} onChange={(e) => setSystemId(e.target.value)}>
          {(systems ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.fipsCategory})
            </option>
          ))}
        </select>
      </div>

      {systemId && <Packet systemId={systemId} />}
    </div>
  );
}

function Packet({ systemId }: { systemId: string }) {
  const { data: impls, loading } = useApi<Impl[]>(`/api/controls?systemId=${systemId}`);
  const { data: requests, refetch } = useApi<EvReq[]>(`/api/evidence-requests?systemId=${systemId}`);
  const [family, setFamily] = useState("ALL");
  const [requestFor, setRequestFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const families = useMemo(() => ["ALL", ...Array.from(new Set((impls ?? []).map((i) => i.control.family)))], [impls]);
  const rows = (impls ?? []).filter((i) => family === "ALL" || i.control.family === family);
  const openByControl = useMemo(() => {
    const m = new Set((requests ?? []).filter((r) => r.status === "OPEN").map((r) => r.controlId));
    return m;
  }, [requests]);

  async function submitRequest(controlId: string) {
    setBusy(true);
    try {
      await apiSend("/api/evidence-requests", "POST", { systemId, controlId, note });
      setRequestFor(null);
      setNote("");
      refetch();
    } finally {
      setBusy(false);
    }
  }

  async function resolve(id: string) {
    const response = window.prompt("Response / how this was addressed (optional):") ?? "";
    await apiSend(`/api/evidence-requests/${id}`, "PATCH", { status: "RESOLVED", response });
    refetch();
  }

  if (loading) return <p className="text-sm text-slate-400">Loading packet…</p>;

  return (
    <div className="space-y-6">
      {requests && requests.length > 0 && (
        <div className="card">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Evidence requests</h2>
          <div className="space-y-2">
            {requests.map((r) => (
              <div key={r.id} className="flex items-start gap-3 rounded-lg border border-ink-800 px-3 py-2">
                <span className={`badge ${r.status === "OPEN" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"}`}>
                  {r.status}
                </span>
                <span className="text-sm font-medium text-slate-200">{r.controlId}</span>
                <span className="min-w-0 flex-1 text-xs text-slate-400">
                  {r.note || "(no note)"}
                  {r.requestedBy && <span className="text-slate-500"> — {r.requestedBy.name}</span>}
                  {r.response && <span className="block text-emerald-700 dark:text-emerald-400">↳ {r.response}</span>}
                </span>
                {r.status === "OPEN" && (
                  <button className="text-xs text-brand-300 hover:underline" onClick={() => resolve(r.id)}>
                    Resolve
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-3 flex flex-wrap gap-1">
          {families.map((f) => (
            <button
              key={f}
              onClick={() => setFamily(f)}
              className={`rounded-md border px-2 py-1 text-xs ${f === family ? "border-brand-500 bg-brand-600/15 text-brand-300" : "border-ink-600 text-slate-300"}`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-ink-700">
          <table className="w-full">
            <thead className="bg-ink-900">
              <tr>
                <th className="th">Control</th>
                <th className="th">Status</th>
                <th className="th">Scoping</th>
                <th className="th">Evidence</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {rows.map((i) => (
                <Row key={i.id} i={i} hasOpen={openByControl.has(i.control.controlId)} requestFor={requestFor} note={note} setNote={setNote} setRequestFor={setRequestFor} submit={submitRequest} busy={busy} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Row({
  i,
  hasOpen,
  requestFor,
  note,
  setNote,
  setRequestFor,
  submit,
  busy,
}: {
  i: Impl;
  hasOpen: boolean;
  requestFor: string | null;
  note: string;
  setNote: (v: string) => void;
  setRequestFor: (v: string | null) => void;
  submit: (controlId: string) => void;
  busy: boolean;
}) {
  const open = requestFor === i.control.controlId;
  return (
    <>
      <tr className="align-top">
        <td className="td">
          <div className="font-medium text-slate-100">{i.control.controlId}</div>
          <div className="text-xs text-slate-500">{i.control.title}</div>
        </td>
        <td className="td"><StatusBadge value={i.status} /></td>
        <td className="td text-xs text-slate-400">{i.scoping.replaceAll("_", " ")}</td>
        <td className="td text-xs text-slate-400">
          {i._count.evidenceLinks} linked
          {i._count.evidenceLinks === 0 && <span className="ml-1 text-amber-600 dark:text-amber-400">⚠</span>}
        </td>
        <td className="td text-right">
          {hasOpen ? (
            <span className="text-xs text-amber-600 dark:text-amber-400">requested</span>
          ) : (
            <button className="text-xs text-brand-300 hover:underline" onClick={() => setRequestFor(open ? null : i.control.controlId)}>
              {open ? "Cancel" : "Request evidence"}
            </button>
          )}
        </td>
      </tr>
      {open && (
        <tr className="bg-ink-900/40">
          <td className="td" colSpan={5}>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="input flex-1"
                placeholder={`What evidence is needed for ${i.control.controlId}?`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button className="btn-primary" disabled={busy} onClick={() => submit(i.control.controlId)}>
                {busy ? "Sending…" : "Send request"}
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
