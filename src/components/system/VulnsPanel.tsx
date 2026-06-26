"use client";

import { useMemo, useRef, useState } from "react";
import { StatusBadge, apiSend, useApi } from "@/components/ui";

type Vuln = {
  id: string;
  pluginId: string | null;
  cve: string | null;
  title: string;
  description: string;
  solution: string;
  severity: string;
  cvss: number | null;
  host: string | null;
  port: string | null;
  source: string;
  state: string;
  priority: string;
  priorityScore: number;
  recommendation: string;
  mappedControl: string | null;
  poamId: string | null;
  firstSeen: string;
};

const SEV_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];

function ageDays(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export function VulnsPanel({ systemId }: { systemId: string }) {
  const { data, loading, refetch } = useApi<Vuln[]>(`/api/vulnerabilities?systemId=${systemId}`);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [error, setError] = useState("");
  const [sev, setSev] = useState("ALL");
  const [showOpenOnly, setShowOpenOnly] = useState(true);

  const rows = useMemo(() => {
    let r = data ?? [];
    if (sev !== "ALL") r = r.filter((v) => v.severity === sev);
    if (showOpenOnly) r = r.filter((v) => v.state === "OPEN");
    return r;
  }, [data, sev, showOpenOnly]);

  const summary = useMemo(() => {
    const open = (data ?? []).filter((v) => v.state === "OPEN");
    const counts: Record<string, number> = {};
    for (const v of open) counts[v.severity] = (counts[v.severity] || 0) + 1;
    return { open: open.length, counts, converted: (data ?? []).filter((v) => v.poamId).length };
  }, [data]);

  async function onImport(file: File) {
    setImporting(true);
    setError("");
    setMsg("");
    try {
      const fd = new FormData();
      fd.set("systemId", systemId);
      fd.set("file", file);
      const res = await fetch("/api/vulnerabilities/import", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Import failed");
      setMsg(`Imported ${body.total} findings from ${body.source} — ${body.created} new, ${body.updated} updated.`);
      refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function setState(id: string, state: string) {
    await apiSend(`/api/vulnerabilities/${id}`, "PATCH", { state });
    refetch();
  }

  async function convert(id: string) {
    try {
      const r = await apiSend<{ poamNumber: string; controlLinked: boolean }>(
        `/api/vulnerabilities/${id}/poam`,
        "POST"
      );
      setMsg(`Created ${r.poamNumber}${r.controlLinked ? " (linked to mapped control)" : ""}.`);
      refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Conversion failed");
    }
  }

  return (
    <div>
      {/* Import + summary */}
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-2xl border border-ink-800 bg-ink-900/60 px-5 py-4">
        <div>
          <div className="text-2xl font-bold text-slate-100">{summary.open}</div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Open findings</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {SEV_ORDER.map((s) =>
            summary.counts[s] ? (
              <span key={s} className="flex items-center gap-1.5">
                <StatusBadge value={s} />
                <span className="text-sm font-semibold text-slate-200">{summary.counts[s]}</span>
              </span>
            ) : null
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-500">{summary.converted} converted to POA&amp;M</span>
          <input
            ref={fileRef}
            type="file"
            accept=".nessus,.xml,.csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
            }}
          />
          <button className="btn-primary" disabled={importing} onClick={() => fileRef.current?.click()}>
            {importing ? "Importing…" : "Import scan (.nessus / .csv)"}
          </button>
        </div>
      </div>

      {msg && <p className="mb-3 text-sm text-emerald-300">{msg}</p>}
      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      {/* Filters */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {["ALL", ...SEV_ORDER].map((s) => (
          <button
            key={s}
            onClick={() => setSev(s)}
            className={`rounded-md border px-2 py-1 text-xs ${
              s === sev ? "border-brand-500 bg-brand-600/15 text-brand-300" : "border-ink-700 text-slate-300"
            }`}
          >
            {s}
          </button>
        ))}
        <label className="ml-2 flex items-center gap-1.5 text-xs text-slate-400">
          <input type="checkbox" checked={showOpenOnly} onChange={(e) => setShowOpenOnly(e.target.checked)} />
          Open only
        </label>
      </div>

      {loading && <p className="text-sm text-slate-400">Loading…</p>}

      {data && data.length === 0 && (
        <p className="text-sm text-slate-400">No findings yet. Import a Nessus or ACAS/CSV scan to begin.</p>
      )}

      {rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-ink-700">
          <table className="w-full">
            <thead className="bg-ink-900">
              <tr>
                <th className="th">Finding</th>
                <th className="th">Sev / CVSS</th>
                <th className="th">Priority</th>
                <th className="th">Control</th>
                <th className="th">Age</th>
                <th className="th">State</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {rows.map((v) => (
                <tr key={v.id} className="align-top hover:bg-ink-900/40">
                  <td className="td max-w-md">
                    <div className="font-medium text-slate-100">{v.title}</div>
                    <div className="text-xs text-slate-500">
                      {[v.host && `${v.host}${v.port ? ":" + v.port : ""}`, v.cve, v.pluginId && `plugin ${v.pluginId}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">{v.recommendation}</div>
                  </td>
                  <td className="td">
                    <StatusBadge value={v.severity} />
                    <div className="mt-1 text-xs text-slate-500">{v.cvss != null ? `CVSS ${v.cvss}` : "—"}</div>
                  </td>
                  <td className="td">
                    <StatusBadge value={v.priority} />
                    <div className="mt-1 text-xs text-slate-500">{v.priorityScore}</div>
                  </td>
                  <td className="td text-xs text-slate-300">{v.mappedControl ?? "—"}</td>
                  <td className="td text-xs text-slate-400">{ageDays(v.firstSeen)}d</td>
                  <td className="td">
                    <select
                      className="input py-1 text-xs"
                      value={v.state}
                      onChange={(e) => setState(v.id, e.target.value)}
                    >
                      {["OPEN", "REMEDIATED", "RISK_ACCEPTED", "FALSE_POSITIVE"].map((s) => (
                        <option key={s} value={s}>
                          {s.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="td text-right">
                    {v.poamId ? (
                      <span className="badge bg-emerald-500/15 text-emerald-300">POA&amp;M ✓</span>
                    ) : (
                      <button className="btn-ghost py-1 text-xs" onClick={() => convert(v.id)}>
                        → POA&amp;M
                      </button>
                    )}
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
