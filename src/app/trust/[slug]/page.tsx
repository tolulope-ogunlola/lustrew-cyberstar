"use client";

import { use, useState } from "react";
import { NDA_TEXT, CURRENT_NDA_VERSION } from "@/lib/trust/nda-text";

type TrustProfile = {
  companyName: string;
  headline: string;
  overview: string;
  frameworks: string[];
  subprocessors: { name: string; purpose: string; location: string }[];
  statusUrl: string;
  contactEmail: string;
  documents: { id: string; title: string; category: string; visibility: string; requiresNda: boolean }[];
};

export default function PublicTrustCenter({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [profile, setProfile] = useState<TrustProfile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // Load once.
  if (!loaded) {
    setLoaded(true);
    fetch(`/api/trust/${slug}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setProfile)
      .catch(() => setNotFound(true));
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold text-slate-100">Trust Center not found</h1>
        <p className="mt-2 text-slate-400">This security profile does not exist or is not published.</p>
      </div>
    );
  }
  if (!profile) return <div className="px-6 py-24 text-center text-slate-400">Loading…</div>;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-2 text-xs uppercase tracking-wide text-brand-300">Trust Center</div>
      <h1 className="text-3xl font-bold text-slate-100">{profile.companyName}</h1>
      {profile.headline && <p className="mt-2 text-lg text-slate-300">{profile.headline}</p>}

      {profile.frameworks.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {profile.frameworks.map((f) => <span key={f} className="badge bg-brand-600/15 text-brand-300">{f}</span>)}
        </div>
      )}

      {profile.overview && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Security commitments</h2>
          <p className="mt-2 whitespace-pre-wrap text-slate-300">{profile.overview}</p>
        </section>
      )}

      {profile.subprocessors.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Subprocessors</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-300">
            {profile.subprocessors.map((s, i) => <li key={i}>{s.name} — {s.purpose} ({s.location})</li>)}
          </ul>
        </section>
      )}

      <DocumentSection slug={slug} documents={profile.documents} />

      <footer className="mt-12 border-t border-ink-800 pt-4 text-xs text-slate-500">
        {profile.contactEmail && <>Security contact: <a className="text-brand-300 hover:underline" href={`mailto:${profile.contactEmail}`}>{profile.contactEmail}</a> · </>}
        {profile.statusUrl && <a className="text-brand-300 hover:underline" href={profile.statusUrl} target="_blank">System status</a>}
      </footer>
    </div>
  );
}

function DocumentSection({ slug, documents }: { slug: string; documents: TrustProfile["documents"] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [form, setForm] = useState({ email: "", name: "", company: "", reason: "" });
  const [stage, setStage] = useState<"list" | "nda" | "done">("list");
  const [requestId, setRequestId] = useState("");
  const [error, setError] = useState("");
  const set = (k: keyof typeof form, v: string) => setForm((c) => ({ ...c, [k]: v }));
  const toggle = (id: string) => setSelected((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const r = await fetch(`/api/trust/${slug}/request-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, requestedDocs: selected }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "Request failed");
      setRequestId(json.accessRequestId);
      setStage("nda");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function acceptNda() {
    setError("");
    try {
      const r = await fetch(`/api/trust/${slug}/nda`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessRequestId: requestId, acceptedName: form.name || form.email, ndaVersion: CURRENT_NDA_VERSION }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Failed");
      setStage("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  if (!documents.length) return null;

  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Documents</h2>
      {stage === "done" ? (
        <div className="mt-3 rounded-lg border border-emerald-700/40 bg-emerald-900/20 p-4 text-sm text-emerald-200">
          Thank you. Your request and NDA acceptance are recorded. Once approved, time-limited download links will be emailed to {form.email}.
        </div>
      ) : stage === "nda" ? (
        <div className="mt-3 space-y-3">
          <div className="max-h-48 overflow-y-auto rounded-lg border border-ink-700 bg-ink-900 p-3 text-xs text-slate-300 whitespace-pre-wrap">{NDA_TEXT}</div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button className="btn-primary" onClick={acceptNda}>I agree — submit request</button>
        </div>
      ) : (
        <form onSubmit={submitRequest} className="mt-3 space-y-3">
          <div className="space-y-1">
            {documents.map((d) => (
              <label key={d.id} className="flex items-center gap-2 rounded-lg border border-ink-700 px-3 py-2 text-sm text-slate-300">
                <input type="checkbox" checked={selected.includes(d.id)} onChange={() => toggle(d.id)} />
                <span className="font-medium text-slate-200">{d.title}</span>
                <span className="ml-auto text-xs text-slate-500">{d.category}{d.requiresNda ? " · NDA" : ""}</span>
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="Work email" type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} />
            <input className="input" placeholder="Name" value={form.name} onChange={(e) => set("name", e.target.value)} />
            <input className="input" placeholder="Company" value={form.company} onChange={(e) => set("company", e.target.value)} />
            <input className="input" placeholder="Reason (optional)" value={form.reason} onChange={(e) => set("reason", e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button className="btn-primary" disabled={selected.length === 0 || !form.email}>Request access</button>
        </form>
      )}
    </section>
  );
}
