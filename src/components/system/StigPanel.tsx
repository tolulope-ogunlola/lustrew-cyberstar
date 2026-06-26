"use client";

import { useMemo, useRef, useState } from "react";
import { StatusBadge, apiSend, useApi } from "@/components/ui";

type Finding = {
  id: string;
  vulnNum: string;
  ruleTitle: string;
  severity: string;
  status: string;
  host: string | null;
  stigName: string;
  cci: string;
  mappedControl: string | null;
  poamId: string | null;
};

const CATS = ["CAT_I", "CAT_II", "CAT_III"];

export function StigPanel({ systemId }: { systemId: string }) {
  const { data, loading, refetch } = useApi<Finding[]>(`/api/stig?systemId=${systemId}`);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [openOnly, setOpenOnly] = useState(true);

  const rows = useMemo(() => {
    let r = data ?? [];
    if (openOnly) r = r.filter((f) => f.status === "OPEN");
    return r;
  }, [data, openOnly]);

  const summary = useMemo(() => {
    const open = (data ?? []).filter((f) => f.status === "OPEN");
    const counts: Record<string, number> = {};
    for (const f of open) counts[f.severity] = (counts[f.severity] || 0) + 1;
    return { open: open.length, counts, total: (data ?? []).length };
  }, [data]);

  async function onImport(file: File) {
    setImporting(true);
    setError("");
    setMsg("");
    try {
      const fd = new FormData();
      fd.set("systemId", systemId);
      fd.set("file", file);
      const res = await fetch("/api/stig/import", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Import failed");
      setMsg(`Imported ${body.total} checks — ${body.created} new, ${body.updated} updated.`);
      refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function setStatus(id: string, status: string) {
    await apiSend(`/api/stig/${id}`, "PATCH", { status });
    refetch();
  }
  async function convert(id: string) {
    try {
      const r = await apiSend<{ poamNumber: string }>(`/api/stig/${id}/poam`, "POST");
      setMsg(`Created ${r.poamNumber}.`);
      refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Conversion failed");
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-2xl border border-ink-800 bg-ink-900/60 px-5 py-4">
        <div>
          <div className="text-2xl font-bold text-slate-100">{summary.open}</div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Open findings</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {CATS.map((c) =>
            summary.counts[c] ? (
              <span key={c} className="flex items-center gap-1.5">
                <StatusBadge value={c} />
                <span className="text-sm font-semibold text-slate-200">{summary.counts[c]}</span>
              </span>
            ) : null
          )}
        </div>
        <div className="ml-auto">
          <input ref={fileRef} type="file" accept=".ckl,.xml" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); }} />
          <button className="btn-primary" disabled={importing} onClick={() => fileRef.current?.click()}>
            {importing ? "Importing…" : "Import checklist (.ckl)"}
          </button>
        </div>
      </div>

      {msg && <p className="mb-3 text-sm text-emerald-300">{msg}</p>}
      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      <label className="mb-3 flex items-center gap-1.5 text-xs text-slate-400">
        <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} />
        Open only
      </label>

      {loading && <p className="text-sm text-slate-400">Loading…</p>}
      {data && data.length === 0 && <p className="text-sm text-slate-400">No findings yet. Import a .ckl checklist to begin.</p>}

      {rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-ink-700">
          <table className="w-full">
            <thead className="bg-ink-900">
              <tr>
                <th className="th">Check</th>
                <th className="th">CAT</th>
                <th className="th">Control</th>
                <th className="th">Status</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {rows.map((f) => (
                <tr key={f.id} className="align-top hover:bg-ink-900/40">
                  <td className="td max-w-md">
                    <div className="font-mono text-xs text-slate-500">{f.vulnNum}</div>
                    <div className="font-medium text-slate-100">{f.ruleTitle}</div>
                    <div className="text-xs text-slate-500">
                      {[f.host, f.stigName, f.cci].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  <td className="td"><StatusBadge value={f.severity} /></td>
                  <td className="td text-xs text-slate-300">{f.mappedControl ?? "—"}</td>
                  <td className="td">
                    <select className="input py-1 text-xs" value={f.status} onChange={(e) => setStatus(f.id, e.target.value)}>
                      {["OPEN", "NOT_A_FINDING", "NOT_APPLICABLE", "NOT_REVIEWED"].map((s) => (
                        <option key={s} value={s}>{s.replaceAll("_", " ")}</option>
                      ))}
                    </select>
                  </td>
                  <td className="td text-right">
                    {f.poamId ? (
                      <span className="badge bg-emerald-500/15 text-emerald-300">POA&amp;M ✓</span>
                    ) : f.status === "OPEN" ? (
                      <button className="btn-ghost py-1 text-xs" onClick={() => convert(f.id)}>→ POA&amp;M</button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
