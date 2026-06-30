"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { StatusBadge, useApi } from "@/components/ui";

type Engagement = { id: string; systemId: string; systemName: string; title: string; scopes: string[]; expiresAt: string };
type ControlRow = { id: string; status: string; scoping: string; control: { controlId: string; title: string }; _count: { evidenceLinks: number } };
type EvidenceRow = { id: string; title: string; type: string; approvalStatus: string; hasFile?: boolean };
type Poam = { id: string; poamNumber: string; weaknessTitle: string; severity: string; status: string };
type Risk = { id: string; riskNumber: string; title: string; status: string };

export default function AuditorPortal() {
  const { data } = useApi<{ engagements: Engagement[] }>("/api/auditor/me");
  const engagements = data?.engagements ?? [];
  const [systemId, setSystemId] = useState<string | null>(null);

  useEffect(() => {
    if (engagements.length && !systemId) setSystemId(engagements[0].systemId);
  }, [engagements, systemId]);

  const active = engagements.find((e) => e.systemId === systemId);

  return (
    <div className="min-h-screen bg-ink-950 text-slate-200">
      <header className="border-b border-ink-800 px-6 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-brand-300">Auditor Portal</div>
            <div className="text-sm text-slate-400">Read-only, scoped access</div>
          </div>
          <button className="btn-ghost py-1 text-xs" onClick={() => signOut({ callbackUrl: "/login" })}>Sign out</button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-6">
        {!data ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : engagements.length === 0 ? (
          <div className="card">No active engagements. Contact your point of contact to be granted access.</div>
        ) : (
          <>
            {engagements.length > 1 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {engagements.map((e) => (
                  <button key={e.id} onClick={() => setSystemId(e.systemId)} className={`rounded-lg border px-3 py-1.5 text-sm ${e.systemId === systemId ? "border-brand-500 bg-brand-600/15 text-brand-300" : "border-ink-700"}`}>{e.systemName}</button>
                ))}
              </div>
            )}
            {active && (
              <div className="mb-5 rounded-lg border border-brand-700/40 bg-brand-900/20 p-4 text-sm">
                <div className="font-medium text-slate-100">{active.systemName}{active.title ? ` — ${active.title}` : ""}</div>
                <div className="mt-1 text-xs text-slate-400">
                  Scopes: {active.scopes.join(", ")} · Access expires {new Date(active.expiresAt).toLocaleDateString()}
                </div>
              </div>
            )}
            {systemId && active && <AuditorPanels systemId={systemId} scopes={active.scopes} />}
          </>
        )}
      </main>
    </div>
  );
}

function AuditorPanels({ systemId, scopes }: { systemId: string; scopes: string[] }) {
  const has = (s: string) => scopes.includes(s);
  return (
    <div className="space-y-6">
      {has("controls") && <ControlsPanel systemId={systemId} />}
      {has("evidence") && <EvidencePanel systemId={systemId} />}
      {has("poams") && <PoamsPanel systemId={systemId} />}
      {has("risks") && <RisksPanel systemId={systemId} />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h2>
      {children}
    </section>
  );
}

function ControlsPanel({ systemId }: { systemId: string }) {
  const { data } = useApi<ControlRow[]>(`/api/controls?systemId=${systemId}`);
  return (
    <Section title="Controls">
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase text-slate-500"><th className="py-1">Control</th><th>Status</th><th>Evidence</th></tr></thead>
          <tbody>
            {(data ?? []).map((c) => (
              <tr key={c.id} className="border-t border-ink-800"><td className="py-1 text-slate-300">{c.control.controlId} — {c.control.title}</td><td><StatusBadge value={c.status} /></td><td className="text-slate-400">{c._count.evidenceLinks}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function EvidencePanel({ systemId }: { systemId: string }) {
  const { data } = useApi<EvidenceRow[]>(`/api/evidence?systemId=${systemId}`);
  return (
    <Section title="Evidence">
      <div className="space-y-2">
        {(data ?? []).map((e) => (
          <div key={e.id} className="card flex items-center justify-between">
            <div><span className="text-slate-200">{e.title}</span><span className="ml-2 text-xs text-slate-500">{e.type}</span></div>
            <div className="flex items-center gap-2">
              <StatusBadge value={e.approvalStatus} />
              {e.hasFile && <a className="text-xs text-brand-300 hover:underline" href={`/api/evidence/${e.id}/file`}>Download</a>}
            </div>
          </div>
        ))}
        {data && data.length === 0 && <p className="text-sm text-slate-500">No evidence.</p>}
      </div>
    </Section>
  );
}

function PoamsPanel({ systemId }: { systemId: string }) {
  const { data } = useApi<Poam[]>(`/api/poams?systemId=${systemId}`);
  return (
    <Section title="POA&Ms">
      <div className="space-y-2">
        {(data ?? []).map((p) => (
          <div key={p.id} className="card flex items-center justify-between">
            <div><span className="text-slate-200">{p.poamNumber}</span><span className="ml-2 text-sm text-slate-400">{p.weaknessTitle}</span></div>
            <div className="flex items-center gap-2"><StatusBadge value={p.severity} /><StatusBadge value={p.status} /></div>
          </div>
        ))}
        {data && data.length === 0 && <p className="text-sm text-slate-500">No POA&Ms.</p>}
      </div>
    </Section>
  );
}

function RisksPanel({ systemId }: { systemId: string }) {
  const { data } = useApi<Risk[]>(`/api/risks?systemId=${systemId}`);
  return (
    <Section title="Risks">
      <div className="space-y-2">
        {(data ?? []).map((r) => (
          <div key={r.id} className="card flex items-center justify-between">
            <div><span className="text-slate-200">{r.riskNumber}</span><span className="ml-2 text-sm text-slate-400">{r.title}</span></div>
            <StatusBadge value={r.status} />
          </div>
        ))}
        {data && data.length === 0 && <p className="text-sm text-slate-500">No risks.</p>}
      </div>
    </Section>
  );
}
