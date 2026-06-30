"use client";

import { useState } from "react";
import { PageHeader, StatusBadge, apiSend, useApi } from "@/components/ui";
import { ENGAGEMENT_SCOPES } from "@/lib/validation";

type Engagement = {
  id: string;
  status: string;
  scopes: string;
  expiresAt: string;
  title: string;
  system: { name: string };
  auditor: { name: string; email: string };
};
type SystemLite = { id: string; name: string };

export default function AuditorsPage() {
  const { data, refetch } = useApi<Engagement[]>("/api/audit-engagements");
  const { data: systems } = useApi<SystemLite[]>("/api/systems");
  const [open, setOpen] = useState(false);

  return (
    <div>
      <PageHeader
        title="External Auditors"
        subtitle="Grant scoped, time-boxed read-only access to a single system"
        actions={<button className="btn-primary" onClick={() => setOpen(true)}>Invite auditor</button>}
      />
      <div className="space-y-2">
        {(data ?? []).map((e) => (
          <div key={e.id} className="card flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2"><span className="font-medium text-slate-100">{e.auditor.name}</span><StatusBadge value={e.status} /></div>
              <div className="text-xs text-slate-500">
                {e.auditor.email} · {e.system.name} · scopes: {(JSON.parse(e.scopes || "[]") as string[]).join(", ")} · expires {new Date(e.expiresAt).toLocaleDateString()}
              </div>
            </div>
            <div className="flex gap-2">
              {e.status === "ACTIVE" && <button className="btn-ghost py-1 text-xs text-amber-400" onClick={async () => { await apiSend(`/api/audit-engagements/${e.id}`, "PATCH", { status: "REVOKED" }); refetch(); }}>Revoke</button>}
              <button className="text-xs text-red-400 hover:underline" onClick={async () => { await apiSend(`/api/audit-engagements/${e.id}`, "DELETE"); refetch(); }}>Delete</button>
            </div>
          </div>
        ))}
        {data && data.length === 0 && <p className="text-sm text-slate-400">No engagements yet.</p>}
      </div>
      {open && <InviteModal systems={systems ?? []} onClose={() => setOpen(false)} onSaved={refetch} />}
    </div>
  );
}

function InviteModal({ systems, onClose, onSaved }: { systems: SystemLite[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ systemId: systems[0]?.id ?? "", auditorName: "", auditorEmail: "", expiresInDays: 30 });
  const [scopes, setScopes] = useState<string[]>(["controls", "evidence", "poams", "risks"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tempPw, setTempPw] = useState("");
  const set = (k: keyof typeof f, v: string | number) => setF((c) => ({ ...c, [k]: v }));
  const toggle = (s: string) => setScopes((c) => (c.includes(s) ? c.filter((x) => x !== s) : [...c, s]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await apiSend<{ tempPassword?: string }>("/api/audit-engagements", "POST", { ...f, expiresInDays: Number(f.expiresInDays), scopes });
      onSaved();
      if (r.tempPassword) setTempPw(r.tempPassword);
      else onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form onSubmit={submit} className="w-full max-w-lg rounded-xl border border-ink-700 bg-ink-900 p-5">
        <h3 className="mb-4 text-lg font-semibold text-slate-100">Invite external auditor</h3>
        {tempPw ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">Engagement created. Share these credentials securely (also emailed):</p>
            <div className="rounded-lg border border-ink-700 bg-ink-950 p-3 text-sm text-slate-200">Email: {f.auditorEmail}<br />Temp password: <span className="font-mono">{tempPw}</span></div>
            <div className="flex justify-end"><button type="button" className="btn-primary" onClick={onClose}>Done</button></div>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div><label className="label">System</label><select className="input" value={f.systemId} onChange={(e) => set("systemId", e.target.value)}>{systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Auditor name</label><input className="input" value={f.auditorName} onChange={(e) => set("auditorName", e.target.value)} required /></div>
                <div><label className="label">Auditor email</label><input className="input" type="email" value={f.auditorEmail} onChange={(e) => set("auditorEmail", e.target.value)} required /></div>
              </div>
              <div>
                <label className="label">Scopes</label>
                <div className="flex flex-wrap gap-2">
                  {ENGAGEMENT_SCOPES.map((s) => (
                    <label key={s} className="flex items-center gap-1 rounded-lg border border-ink-700 px-2 py-1 text-xs text-slate-300">
                      <input type="checkbox" checked={scopes.includes(s)} onChange={() => toggle(s)} /> {s}
                    </label>
                  ))}
                </div>
              </div>
              <div><label className="label">Access duration (days)</label><input className="input" type="number" min={1} max={365} value={f.expiresInDays} onChange={(e) => set("expiresInDays", Number(e.target.value))} /></div>
            </div>
            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn-primary" disabled={busy || scopes.length === 0}>{busy ? "Inviting…" : "Invite"}</button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
