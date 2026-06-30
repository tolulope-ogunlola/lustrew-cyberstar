"use client";

import { useState } from "react";
import { PageHeader, StatusBadge, apiSend, useApi } from "@/components/ui";
import { TRUST_DOC_CATEGORY, TRUST_DOC_VISIBILITY } from "@/lib/validation";

type TrustConfig = {
  slug: string | null;
  published: boolean;
  companyName: string;
  headline: string;
  overview: string;
  frameworks: string[];
  statusUrl: string;
  contactEmail: string;
};
type Doc = { id: string; title: string; category: string; visibility: string; _count: { grants: number } };
type AccessReq = { id: string; email: string; name: string; company: string; status: string; createdAt: string; nda: { acceptedAt: string } | null; _count: { grants: number } };
type Log = { id: string; email: string; event: string; createdAt: string };

const TABS = ["Profile", "Documents", "Requests", "Logs"] as const;

export default function TrustAdminPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Profile");
  return (
    <div>
      <PageHeader title="Trust Center" subtitle="Curate your public security profile and manage gated document access" />
      <div className="mb-5 flex gap-2">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg border px-3 py-1.5 text-sm ${t === tab ? "border-brand-500 bg-brand-600/15 text-brand-300" : "border-ink-700 text-slate-300 hover:bg-ink-800"}`}>{t}</button>
        ))}
      </div>
      {tab === "Profile" && <ProfileTab />}
      {tab === "Documents" && <DocumentsTab />}
      {tab === "Requests" && <RequestsTab />}
      {tab === "Logs" && <LogsTab />}
    </div>
  );
}

function ProfileTab() {
  const { data, refetch } = useApi<TrustConfig>("/api/admin/trust");
  const [f, setF] = useState<Partial<TrustConfig> | null>(null);
  const [msg, setMsg] = useState("");
  const cur = { ...data, ...f } as TrustConfig;
  const set = (k: keyof TrustConfig, v: unknown) => setF((c) => ({ ...c, [k]: v }));

  async function save() {
    setMsg("");
    try {
      await apiSend("/api/admin/trust", "PATCH", {
        slug: cur.slug || undefined,
        published: cur.published,
        companyName: cur.companyName,
        headline: cur.headline,
        overview: cur.overview,
        frameworks: cur.frameworks,
        statusUrl: cur.statusUrl,
        contactEmail: cur.contactEmail,
      });
      setMsg("Saved.");
      setF(null);
      refetch();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }

  if (!data) return <p className="text-sm text-slate-400">Loading…</p>;
  return (
    <div className="max-w-2xl space-y-3">
      <div className="card flex items-center justify-between">
        <div>
          <div className="font-medium text-slate-100">Publication</div>
          <div className="text-xs text-slate-500">{cur.slug ? `Public at /trust/${cur.slug}` : "Set a URL slug to publish"}</div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={!!cur.published} onChange={(e) => set("published", e.target.checked)} /> Published
        </label>
      </div>
      <div><label className="label">Public URL slug</label><input className="input" value={cur.slug ?? ""} onChange={(e) => set("slug", e.target.value)} placeholder="acme" /></div>
      <div><label className="label">Company name</label><input className="input" value={cur.companyName ?? ""} onChange={(e) => set("companyName", e.target.value)} /></div>
      <div><label className="label">Headline</label><input className="input" value={cur.headline ?? ""} onChange={(e) => set("headline", e.target.value)} /></div>
      <div><label className="label">Security overview</label><textarea className="input h-28" value={cur.overview ?? ""} onChange={(e) => set("overview", e.target.value)} /></div>
      <div><label className="label">Frameworks (comma-separated)</label><input className="input" value={(cur.frameworks ?? []).join(", ")} onChange={(e) => set("frameworks", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} placeholder="SOC 2, ISO 27001" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Status page URL</label><input className="input" value={cur.statusUrl ?? ""} onChange={(e) => set("statusUrl", e.target.value)} /></div>
        <div><label className="label">Contact email</label><input className="input" value={cur.contactEmail ?? ""} onChange={(e) => set("contactEmail", e.target.value)} /></div>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={!f}>Save changes</button>
        {msg && <span className="text-sm text-slate-400">{msg}</span>}
      </div>
    </div>
  );
}

function DocumentsTab() {
  const { data, refetch } = useApi<Doc[]>("/api/admin/trust/documents");
  const [f, setF] = useState({ title: "", category: "OTHER", visibility: "GATED", evidenceId: "" });
  const set = (k: keyof typeof f, v: string) => setF((c) => ({ ...c, [k]: v }));

  async function add() {
    await apiSend("/api/admin/trust/documents", "POST", { ...f, evidenceId: f.evidenceId || null });
    setF({ title: "", category: "OTHER", visibility: "GATED", evidenceId: "" });
    refetch();
  }

  return (
    <div className="space-y-3">
      <div className="card grid grid-cols-1 gap-2 md:grid-cols-4">
        <input className="input" placeholder="Document title" value={f.title} onChange={(e) => set("title", e.target.value)} />
        <select className="input" value={f.category} onChange={(e) => set("category", e.target.value)}>{TRUST_DOC_CATEGORY.map((c) => <option key={c}>{c}</option>)}</select>
        <select className="input" value={f.visibility} onChange={(e) => set("visibility", e.target.value)}>{TRUST_DOC_VISIBILITY.map((c) => <option key={c}>{c}</option>)}</select>
        <button className="btn-primary" onClick={add} disabled={!f.title}>Add document</button>
      </div>
      <p className="text-[11px] text-slate-500">Tip: link an uploaded evidence artifact (with a stored file) so gated downloads stream from secure storage. Plain entries are list-only.</p>
      {(data ?? []).map((d) => (
        <div key={d.id} className="card flex items-center justify-between">
          <div>
            <span className="font-medium text-slate-100">{d.title}</span>
            <div className="text-xs text-slate-500">{d.category} · {d.visibility} · {d._count.grants} grant(s)</div>
          </div>
          <button className="text-xs text-red-400 hover:underline" onClick={async () => { await apiSend(`/api/admin/trust/documents/${d.id}`, "DELETE"); refetch(); }}>Delete</button>
        </div>
      ))}
      {data && data.length === 0 && <p className="text-sm text-slate-400">No documents yet.</p>}
    </div>
  );
}

function RequestsTab() {
  const { data, refetch } = useApi<AccessReq[]>("/api/admin/trust/requests");
  async function decide(id: string, decision: "APPROVE" | "DENY") {
    try {
      await apiSend(`/api/admin/trust/requests/${id}`, "PATCH", { decision });
      refetch();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    }
  }
  return (
    <div className="space-y-2">
      {(data ?? []).map((r) => (
        <div key={r.id} className="card flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><span className="font-medium text-slate-100">{r.name || r.email}</span><StatusBadge value={r.status} /></div>
            <div className="text-xs text-slate-500">{r.email} · {r.company || "—"} · NDA {r.nda ? "accepted ✓" : "pending"} · {new Date(r.createdAt).toLocaleDateString()}</div>
          </div>
          {r.status === "PENDING" && (
            <div className="flex gap-2">
              <button className="btn-ghost py-1 text-xs text-emerald-400" disabled={!r.nda} onClick={() => decide(r.id, "APPROVE")}>Approve</button>
              <button className="btn-ghost py-1 text-xs text-red-400" onClick={() => decide(r.id, "DENY")}>Deny</button>
            </div>
          )}
        </div>
      ))}
      {data && data.length === 0 && <p className="text-sm text-slate-400">No access requests.</p>}
    </div>
  );
}

function LogsTab() {
  const { data } = useApi<Log[]>("/api/admin/trust/logs");
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs uppercase text-slate-500"><th className="py-1">When</th><th>Email</th><th>Event</th></tr></thead>
        <tbody>
          {(data ?? []).map((l) => (
            <tr key={l.id} className="border-t border-ink-800"><td className="py-1 text-slate-400">{new Date(l.createdAt).toLocaleString()}</td><td className="text-slate-300">{l.email}</td><td><StatusBadge value={l.event} /></td></tr>
          ))}
        </tbody>
      </table>
      {data && data.length === 0 && <p className="text-sm text-slate-400">No access activity yet.</p>}
    </div>
  );
}
