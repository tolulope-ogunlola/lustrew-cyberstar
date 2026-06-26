"use client";

import { useState } from "react";
import { PageHeader, StatusBadge, apiSend, useApi } from "@/components/ui";
import { Icon } from "@/components/icons";
import { CONNECTORS, REGISTRY } from "@/lib/integrations/registry";
import type { ConnectorMeta, IntegrationType } from "@/lib/integrations/types";

type Integration = {
  id: string;
  type: IntegrationType;
  name: string;
  enabled: boolean;
  systemId: string | null;
  lastSyncAt: string | null;
  lastResult: string;
  config: Record<string, unknown>;
};
type SystemRow = { id: string; name: string };

export default function IntegrationsPage() {
  const { data, loading, refetch } = useApi<Integration[]>("/api/integrations");
  const { data: systems } = useApi<SystemRow[]>("/api/systems");
  const [adding, setAdding] = useState<ConnectorMeta | null>(null);
  const [msg, setMsg] = useState("");
  const [emassSystem, setEmassSystem] = useState("");

  async function patch(id: string, body: Record<string, unknown>) {
    await apiSend(`/api/integrations/${id}`, "PATCH", body);
    refetch();
  }
  async function test(id: string) {
    setMsg("Testing…");
    const r = await apiSend<{ ok: boolean; message: string }>(`/api/integrations/${id}/test`, "POST");
    setMsg(`${r.ok ? "✓" : "✗"} ${r.message}`);
  }
  async function sync(id: string) {
    setMsg("Syncing…");
    try {
      const r = await apiSend<{ total: number; created: number; updated: number }>(`/api/integrations/${id}/sync`, "POST");
      setMsg(`✓ Synced ${r.total} findings (${r.created} new, ${r.updated} updated).`);
      refetch();
    } catch (e) {
      setMsg(`✗ ${e instanceof Error ? e.message : "Sync failed"}`);
    }
  }
  async function remove(id: string) {
    await apiSend(`/api/integrations/${id}`, "DELETE");
    refetch();
  }

  return (
    <div>
      <PageHeader title="Integrations" subtitle="Connect scanners, ITSM, and GRC platforms" />

      {msg && <div className="mb-4 rounded-lg border border-ink-700 bg-ink-900/60 px-4 py-2 text-sm text-slate-200">{msg}</div>}

      {/* Configured */}
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Configured</h2>
      {loading && <p className="text-sm text-slate-400">Loading…</p>}
      {data && data.length === 0 && <p className="mb-6 text-sm text-slate-400">No integrations yet — add one below.</p>}
      <div className="mb-8 space-y-3">
        {(data ?? []).map((it) => {
          const meta = REGISTRY[it.type];
          const isScanner = meta.capabilities.includes("SYNC");
          return (
            <div key={it.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="icon-tile bg-accent-500/15 text-accent-400"><Icon name="plug" className="h-5 w-5" /></div>
                  <div>
                    <div className="font-semibold text-slate-100">{it.name}</div>
                    <div className="text-xs text-slate-500">{meta.label} · {meta.category}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge value={it.enabled ? "ACTIVE" : "INACTIVE"} />
                  {(it.config as { mock?: boolean }).mock && <span className="badge bg-sky-500/15 text-sky-300">mock</span>}
                </div>
              </div>
              {isScanner && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-slate-500">Target system:</span>
                  <select
                    className="input max-w-[220px] py-1 text-xs"
                    value={it.systemId ?? ""}
                    onChange={(e) => patch(it.id, { systemId: e.target.value || null })}
                  >
                    <option value="">— choose —</option>
                    {(systems ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              {it.lastResult && <p className="mt-2 text-xs text-slate-500">Last: {it.lastResult}{it.lastSyncAt ? ` · ${new Date(it.lastSyncAt).toLocaleString()}` : ""}</p>}
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <button className="btn-ghost py-1" onClick={() => test(it.id)}>Test</button>
                {isScanner && <button className="btn-ghost py-1" onClick={() => sync(it.id)}>Sync now</button>}
                <button className="btn-ghost py-1" onClick={() => patch(it.id, { enabled: !it.enabled })}>{it.enabled ? "Disable" : "Enable"}</button>
                <button className="py-1 text-red-400 hover:underline" onClick={() => remove(it.id)}>Delete</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Available connectors */}
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Available connectors</h2>
      <div className="mb-8 grid gap-3 md:grid-cols-2">
        {CONNECTORS.map((c) => (
          <div key={c.type} className="card flex items-start justify-between gap-3">
            <div>
              <div className="font-medium text-slate-100">{c.label}</div>
              <p className="mt-0.5 text-sm text-slate-400">{c.description}</p>
              <div className="mt-1 flex gap-1">
                {c.capabilities.map((cap) => <span key={cap} className="badge bg-ink-700 text-slate-300">{cap}</span>)}
              </div>
            </div>
            {c.type === "EMASS" ? (
              <span className="text-xs text-slate-500">below ↓</span>
            ) : (
              <button className="btn-ghost py-1 text-xs" onClick={() => setAdding(c)}>Connect</button>
            )}
          </div>
        ))}
      </div>

      {/* eMASS export */}
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">eMASS export</h2>
      <div className="card flex flex-wrap items-center gap-3">
        <span className="text-sm text-slate-400">Export POA&amp;Ms in eMASS CSV layout for</span>
        <select className="input max-w-[220px] py-1 text-sm" value={emassSystem} onChange={(e) => setEmassSystem(e.target.value)}>
          <option value="">— choose system —</option>
          {(systems ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <a
          href={emassSystem ? `/api/integrations/emass?systemId=${emassSystem}` : undefined}
          className={`btn-primary py-1 text-sm ${emassSystem ? "" : "pointer-events-none opacity-40"}`}
        >
          Download CSV
        </a>
      </div>

      {adding && (
        <ConnectModal meta={adding} systems={systems ?? []} onClose={() => setAdding(null)} onSaved={() => { setAdding(null); refetch(); }} />
      )}
    </div>
  );
}

function ConnectModal({ meta, systems, onClose, onSaved }: { meta: ConnectorMeta; systems: SystemRow[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(meta.label);
  const [config, setConfig] = useState<Record<string, unknown>>(
    meta.capabilities.includes("SYNC") || meta.type === "SERVICENOW" ? { mock: true } : {}
  );
  const [systemId, setSystemId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isScanner = meta.capabilities.includes("SYNC");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiSend("/api/integrations", "POST", { type: meta.type, name, config, systemId: systemId || null });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-xl border border-ink-700 bg-ink-900 p-5">
        <h3 className="mb-1 text-lg font-semibold text-slate-100">Connect {meta.label}</h3>
        <p className="mb-4 text-xs text-slate-500">{meta.description}</p>
        <div className="space-y-3">
          <div>
            <label className="label">Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          {meta.configFields.map((f) =>
            f.type === "checkbox" ? (
              <label key={f.key} className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={Boolean(config[f.key])} onChange={(e) => setConfig((c) => ({ ...c, [f.key]: e.target.checked }))} />
                {f.label}
              </label>
            ) : (
              <div key={f.key}>
                <label className="label">{f.label}</label>
                <input
                  className="input"
                  type={f.type === "password" ? "password" : "text"}
                  placeholder={f.placeholder}
                  value={String(config[f.key] ?? "")}
                  onChange={(e) => setConfig((c) => ({ ...c, [f.key]: e.target.value }))}
                />
              </div>
            )
          )}
          {isScanner && (
            <div>
              <label className="label">Target system (for sync)</label>
              <select className="input" value={systemId} onChange={(e) => setSystemId(e.target.value)}>
                <option value="">— choose later —</option>
                {systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? "Connecting…" : "Connect"}</button>
        </div>
      </form>
    </div>
  );
}
