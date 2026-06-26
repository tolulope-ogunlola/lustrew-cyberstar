"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader, StatusBadge, apiSend, useApi } from "@/components/ui";
import { FRAMEWORKS, FIPS } from "@/lib/validation";

type SystemRow = {
  id: string;
  name: string;
  description: string;
  fipsCategory: string;
  frameworks: string[];
  owner: { name: string } | null;
  _count: { implementations: number; poams: number; evidence: number };
};

export default function SystemsPage() {
  const { data, loading, refetch } = useApi<SystemRow[]>("/api/systems");
  const [open, setOpen] = useState(false);

  return (
    <div>
      <PageHeader
        title="Systems"
        subtitle="Authorization boundaries under management"
        actions={
          <button className="btn-primary" onClick={() => setOpen(true)}>
            New system
          </button>
        }
      />

      {loading && <p className="text-sm text-slate-400">Loading…</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {(data ?? []).map((s) => (
          <Link key={s.id} href={`/systems/${s.id}`} className="card block hover:border-brand-600">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-semibold text-slate-100">{s.name}</div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-400">{s.description || "—"}</p>
              </div>
              <StatusBadge value={s.fipsCategory} />
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {s.frameworks.map((f) => (
                <span key={f} className="badge bg-ink-700 text-slate-300">
                  {f.replaceAll("_", " ")}
                </span>
              ))}
            </div>
            <div className="mt-3 flex gap-4 text-xs text-slate-500">
              <span>{s._count.implementations} controls</span>
              <span>{s._count.evidence} evidence</span>
              <span>{s._count.poams} POA&amp;Ms</span>
              <span>Owner: {s.owner?.name ?? "—"}</span>
            </div>
          </Link>
        ))}
      </div>

      {open && <CreateSystemModal onClose={() => setOpen(false)} onCreated={refetch} />}
    </div>
  );
}

function CreateSystemModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fipsCategory, setFips] = useState<string>("MODERATE");
  const [frameworks, setFrameworks] = useState<string[]>(["NIST_RMF", "NIST_800_53"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function toggle(f: string) {
    setFrameworks((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiSend("/api/systems", "POST", { name, description, fipsCategory, frameworks });
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form onSubmit={submit} className="w-full max-w-lg rounded-xl border border-ink-700 bg-ink-900 p-5">
        <h3 className="mb-4 text-lg font-semibold text-slate-100">New system</h3>
        <div className="space-y-3">
          <div>
            <label className="label">Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input h-20" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="label">FIPS 199 categorization</label>
            <select className="input" value={fipsCategory} onChange={(e) => setFips(e.target.value)}>
              {FIPS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Frameworks</label>
            <div className="flex flex-wrap gap-2">
              {FRAMEWORKS.map((f) => (
                <button
                  type="button"
                  key={f}
                  onClick={() => toggle(f)}
                  className={`rounded-lg border px-2 py-1 text-xs ${
                    frameworks.includes(f)
                      ? "border-brand-500 bg-brand-600/15 text-brand-300"
                      : "border-ink-600 text-slate-300"
                  }`}
                >
                  {f.replaceAll("_", " ")}
                </button>
              ))}
            </div>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={busy || !frameworks.length}>
            {busy ? "Creating…" : "Create system"}
          </button>
        </div>
      </form>
    </div>
  );
}
