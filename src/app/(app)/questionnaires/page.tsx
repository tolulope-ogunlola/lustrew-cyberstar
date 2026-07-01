"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader, StatusBadge, apiSend, useApi } from "@/components/ui";

type Questionnaire = { id: string; name: string; customer: string; status: string; createdAt: string; _count: { items: number } };
type Answer = { id: string; question: string; answer: string; category: string; status: string };

const TABS = ["Questionnaires", "Answer Library"] as const;

export default function QuestionnairesPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Questionnaires");
  return (
    <div>
      <PageHeader title="Security Questionnaires" subtitle="Import customer questionnaires, auto-draft from your answer library + AI, approve, and export" />
      <div className="mb-5 flex gap-2">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg border px-3 py-1.5 text-sm ${t === tab ? "border-brand-500 bg-brand-600/15 text-brand-300" : "border-ink-700 text-slate-300 hover:bg-ink-800"}`}>{t}</button>
        ))}
      </div>
      {tab === "Questionnaires" ? <QuestionnaireList /> : <AnswerLibrary />}
    </div>
  );
}

function QuestionnaireList() {
  const { data, refetch } = useApi<Questionnaire[]>("/api/questionnaires");
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div>
      <div className="mb-4 flex justify-end"><button className="btn-primary" onClick={() => setImportOpen(true)}>Import questionnaire</button></div>
      <div className="space-y-2">
        {(data ?? []).map((q) => (
          <Link key={q.id} href={`/questionnaires/${q.id}`} className="card flex items-center justify-between hover:border-brand-600">
            <div>
              <div className="flex items-center gap-2"><span className="font-medium text-slate-100">{q.name}</span><StatusBadge value={q.status} /></div>
              <div className="text-xs text-slate-500">{q.customer || "—"} · {q._count.items} question(s) · {new Date(q.createdAt).toLocaleDateString()}</div>
            </div>
            <span className="text-xs text-brand-300">Open →</span>
          </Link>
        ))}
        {data && data.length === 0 && <p className="text-sm text-slate-400">No questionnaires yet. Import a CSV or XLSX to get started.</p>}
      </div>
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} onDone={refetch} />}
    </div>
  );
}

function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [customer, setCustomer] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.set("name", name);
      fd.set("customer", customer);
      fd.set("file", file);
      const res = await fetch("/api/questionnaires/import", { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Import failed");
      onDone();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form onSubmit={submit} className="w-full max-w-lg rounded-xl border border-ink-700 bg-ink-900 p-5">
        <h3 className="mb-4 text-lg font-semibold text-slate-100">Import questionnaire</h3>
        <div className="space-y-3">
          <div><label className="label">Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div><label className="label">Customer</label><input className="input" value={customer} onChange={(e) => setCustomer(e.target.value)} /></div>
          <div>
            <label className="label">File (CSV or XLSX)</label>
            <input type="file" accept=".csv,.xlsx" className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-ink-700 file:px-3 file:py-1.5 file:text-slate-200" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <p className="mt-1 text-[11px] text-slate-500">A column headed “Question” (or the first column) becomes the items.</p>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy || !file || !name}>{busy ? "Importing…" : "Import"}</button>
        </div>
      </form>
    </div>
  );
}

function AnswerLibrary() {
  const { data, refetch } = useApi<Answer[]>("/api/answer-library");
  const [f, setF] = useState({ question: "", answer: "", category: "General" });
  const set = (k: keyof typeof f, v: string) => setF((c) => ({ ...c, [k]: v }));

  async function add() {
    await apiSend("/api/answer-library", "POST", f);
    setF({ question: "", answer: "", category: "General" });
    refetch();
  }

  return (
    <div className="space-y-3">
      <div className="card space-y-2">
        <input className="input" placeholder="Question" value={f.question} onChange={(e) => set("question", e.target.value)} />
        <textarea className="input h-20" placeholder="Approved answer" value={f.answer} onChange={(e) => set("answer", e.target.value)} />
        <div className="flex gap-2">
          <input className="input" placeholder="Category" value={f.category} onChange={(e) => set("category", e.target.value)} />
          <button className="btn-primary" onClick={add} disabled={!f.question || !f.answer}>Add answer</button>
        </div>
      </div>
      {(data ?? []).map((a) => (
        <div key={a.id} className="card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-medium text-slate-100">{a.question}</div>
              <div className="mt-1 text-sm text-slate-400">{a.answer}</div>
              <div className="mt-1 text-xs text-slate-500">{a.category}</div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge value={a.status} />
              <button className="text-xs text-red-400 hover:underline" onClick={async () => { await apiSend(`/api/answer-library/${a.id}`, "DELETE"); refetch(); }}>Delete</button>
            </div>
          </div>
        </div>
      ))}
      {data && data.length === 0 && <p className="text-sm text-slate-400">No library answers yet. Add approved answers so the AI drafter can reuse them.</p>}
    </div>
  );
}
