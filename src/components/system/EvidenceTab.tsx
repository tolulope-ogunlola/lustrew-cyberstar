"use client";

import { useState } from "react";
import { apiSend, useApi } from "@/components/ui";

type EvidenceRow = {
  id: string;
  title: string;
  type: string;
  url: string;
  note: string;
  createdAt: string;
  hasFile?: boolean;
  fileName?: string | null;
  fileSize?: number | null;
  uploadedBy: { name: string } | null;
  links: { implementation: { control: { controlId: string } } }[];
};

function humanSize(bytes?: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

type ImplLite = { id: string; control: { controlId: string; title: string } };

export function EvidenceTab({ systemId }: { systemId: string }) {
  const { data, loading, refetch } = useApi<EvidenceRow[]>(`/api/evidence?systemId=${systemId}`);
  const { data: impls } = useApi<ImplLite[]>(`/api/controls?systemId=${systemId}`);
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button className="btn-primary" onClick={() => setOpen(true)}>
          Add evidence
        </button>
      </div>

      {loading && <p className="text-sm text-slate-400">Loading…</p>}

      <div className="space-y-3">
        {(data ?? []).map((e) => (
          <div key={e.id} className="card">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium text-slate-100">{e.title}</div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {e.type} · {e.uploadedBy?.name ?? "—"} · {new Date(e.createdAt).toLocaleDateString()}
                </div>
                {e.url && (
                  <a href={e.url} target="_blank" className="mt-1 block text-xs text-brand-300 hover:underline">
                    {e.url}
                  </a>
                )}
                {e.hasFile && (
                  <a
                    href={`/api/evidence/${e.id}/file`}
                    className="mt-1 inline-flex items-center gap-1 text-xs text-brand-300 hover:underline"
                  >
                    ⬇ {e.fileName} <span className="text-slate-500">{humanSize(e.fileSize)}</span>
                  </a>
                )}
              </div>
              <button
                className="text-xs text-red-400 hover:underline"
                onClick={async () => {
                  await apiSend(`/api/evidence/${e.id}`, "DELETE");
                  refetch();
                }}
              >
                Delete
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {e.links.length ? (
                e.links.map((l, i) => (
                  <span key={i} className="badge bg-ink-700 text-slate-300">
                    {l.implementation.control.controlId}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-500">No control links</span>
              )}
            </div>
          </div>
        ))}
        {data && data.length === 0 && (
          <p className="text-sm text-slate-400">No evidence yet.</p>
        )}
      </div>

      {open && (
        <AddEvidenceModal
          systemId={systemId}
          impls={impls ?? []}
          onClose={() => setOpen(false)}
          onCreated={refetch}
        />
      )}
    </div>
  );
}

function AddEvidenceModal({
  systemId,
  impls,
  onClose,
  onCreated,
}: {
  systemId: string;
  impls: ImplLite[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("Document");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function toggle(id: string) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (file) {
        // Multipart upload path.
        const fd = new FormData();
        fd.set("systemId", systemId);
        fd.set("title", title);
        fd.set("type", type);
        fd.set("note", note);
        fd.set("implementationIds", JSON.stringify(selected));
        fd.set("file", file);
        const res = await fetch("/api/evidence/upload", { method: "POST", body: fd });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Upload failed");
      } else {
        await apiSend("/api/evidence", "POST", {
          systemId,
          title,
          type,
          url,
          note,
          implementationIds: selected,
        });
      }
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
        <h3 className="mb-4 text-lg font-semibold text-slate-100">Add evidence</h3>
        <div className="space-y-3">
          <div>
            <label className="label">Title</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
                {["Document", "Policy", "Screenshot", "Scan", "Config", "Report"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Link / reference URL</label>
              <input
                className="input"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                disabled={!!file}
              />
            </div>
          </div>
          <div>
            <label className="label">Upload file (optional)</label>
            <input
              type="file"
              className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-ink-700 file:px-3 file:py-1.5 file:text-slate-200 hover:file:bg-ink-600"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Max 25 MB · PDF, image, CSV, JSON, Office docs. A file is stored securely and overrides the URL.
            </p>
          </div>
          <div>
            <label className="label">Note</label>
            <textarea className="input h-16" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div>
            <label className="label">Link to controls ({selected.length} selected)</label>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-ink-700 p-2">
              {impls.map((i) => (
                <label key={i.id} className="flex cursor-pointer items-center gap-2 py-0.5 text-xs text-slate-300">
                  <input type="checkbox" checked={selected.includes(i.id)} onChange={() => toggle(i.id)} />
                  <span className="font-medium text-slate-200">{i.control.controlId}</span>
                  <span className="text-slate-500">{i.control.title}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Add evidence"}
          </button>
        </div>
      </form>
    </div>
  );
}
