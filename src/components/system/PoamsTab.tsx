"use client";

import { useState } from "react";
import { StatusBadge, apiSend, useApi } from "@/components/ui";
import { AiDraftPanel } from "@/components/AiDraftPanel";
import { SEVERITY, POAM_STATUS } from "@/lib/validation";

type Milestone = { id: string; description: string; dueDate: string | null; done: boolean };
type Poam = {
  id: string;
  poamNumber: string;
  weaknessTitle: string;
  weaknessDescription: string;
  severity: string;
  status: string;
  scheduledCompletion: string | null;
  owner: { name: string } | null;
  implementation: { control: { controlId: string } } | null;
  milestones: Milestone[];
};

type ImplLite = { id: string; control: { controlId: string; title: string } };

function overdue(p: Poam) {
  return (
    p.scheduledCompletion != null &&
    new Date(p.scheduledCompletion) < new Date() &&
    !["COMPLETED", "CLOSED", "RISK_ACCEPTED"].includes(p.status)
  );
}

export function PoamsTab({ systemId }: { systemId: string }) {
  const { data, loading, refetch } = useApi<Poam[]>(`/api/poams?systemId=${systemId}`);
  const { data: impls } = useApi<ImplLite[]>(`/api/controls?systemId=${systemId}`);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button className="btn-primary" onClick={() => setOpen(true)}>
          New POA&amp;M
        </button>
      </div>

      {loading && <p className="text-sm text-slate-400">Loading…</p>}

      <div className="space-y-3">
        {(data ?? []).map((p) => (
          <div key={p.id} className="card">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-500">{p.poamNumber}</span>
                  <StatusBadge value={p.severity} />
                  <StatusBadge value={p.status} />
                  {overdue(p) && <span className="badge bg-red-600/20 text-red-300">OVERDUE</span>}
                </div>
                <div className="mt-1 font-medium text-slate-100">{p.weaknessTitle}</div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {p.implementation ? `Control ${p.implementation.control.controlId} · ` : ""}
                  Owner: {p.owner?.name ?? "—"}
                  {p.scheduledCompletion
                    ? ` · Due ${new Date(p.scheduledCompletion).toLocaleDateString()}`
                    : ""}
                </div>
              </div>
              <button
                className="text-xs text-brand-300 hover:underline"
                onClick={() => setExpanded(expanded === p.id ? null : p.id)}
              >
                {expanded === p.id ? "Close" : "Manage"}
              </button>
            </div>

            {expanded === p.id && (
              <PoamDetail poam={p} impls={impls ?? []} systemId={systemId} onChanged={refetch} />
            )}
          </div>
        ))}
        {data && data.length === 0 && <p className="text-sm text-slate-400">No POA&amp;Ms yet.</p>}
      </div>

      {open && (
        <CreatePoamModal
          systemId={systemId}
          impls={impls ?? []}
          onClose={() => setOpen(false)}
          onCreated={refetch}
        />
      )}
    </div>
  );
}

function PoamDetail({
  poam,
  systemId,
  onChanged,
}: {
  poam: Poam;
  impls: ImplLite[];
  systemId: string;
  onChanged: () => void;
}) {
  const [status, setStatus] = useState(poam.status);
  const [note, setNote] = useState("");
  const [newMilestone, setNewMilestone] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveStatus() {
    setBusy(true);
    try {
      await apiSend(`/api/poams/${poam.id}`, "PATCH", { status, statusNote: note });
      setNote("");
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function toggleMilestone(m: Milestone) {
    await apiSend(`/api/poams/${poam.id}/milestones`, "PATCH", { milestoneId: m.id, done: !m.done });
    onChanged();
  }

  async function addMilestone() {
    if (!newMilestone.trim()) return;
    await apiSend(`/api/poams/${poam.id}/milestones`, "POST", { description: newMilestone });
    setNewMilestone("");
    onChanged();
  }

  return (
    <div className="mt-3 border-t border-ink-800 pt-3">
      <p className="mb-3 text-sm text-slate-300">{poam.weaknessDescription || "No description."}</p>

      <div className="mb-4">
        <label className="label">Milestones</label>
        <div className="space-y-1">
          {poam.milestones.map((m) => (
            <label key={m.id} className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={m.done} onChange={() => toggleMilestone(m)} />
              <span className={m.done ? "line-through text-slate-500" : ""}>{m.description}</span>
              {m.dueDate && (
                <span className="text-xs text-slate-500">({new Date(m.dueDate).toLocaleDateString()})</span>
              )}
            </label>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            className="input py-1 text-xs"
            placeholder="Add milestone…"
            value={newMilestone}
            onChange={(e) => setNewMilestone(e.target.value)}
          />
          <button className="btn-ghost py-1 text-xs" onClick={addMilestone}>
            Add
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="label">Status</label>
          <select className="input py-1 text-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
            {POAM_STATUS.map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <input
          className="input flex-1 py-1 text-xs"
          placeholder="Status note (recorded in history)…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button className="btn-primary py-1 text-xs" onClick={saveStatus} disabled={busy}>
          Save
        </button>
      </div>
    </div>
  );
}

function CreatePoamModal({
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
  const [weaknessTitle, setTitle] = useState("");
  const [weaknessDescription, setDescription] = useState("");
  const [severity, setSeverity] = useState("MODERATE");
  const [source, setSource] = useState("Manual");
  const [implementationId, setImpl] = useState("");
  const [scheduledCompletion, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [showAi, setShowAi] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiSend("/api/poams", "POST", {
        systemId,
        weaknessTitle,
        weaknessDescription,
        severity,
        riskRating: severity,
        source,
        implementationId: implementationId || null,
        scheduledCompletion: scheduledCompletion ? new Date(scheduledCompletion).toISOString() : null,
      });
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
        <h3 className="mb-4 text-lg font-semibold text-slate-100">New POA&amp;M</h3>
        <div className="space-y-3">
          <div>
            <label className="label">Weakness title</label>
            <input className="input" value={weaknessTitle} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Severity</label>
              <select className="input" value={severity} onChange={(e) => setSeverity(e.target.value)}>
                {SEVERITY.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Source</label>
              <select className="input" value={source} onChange={(e) => setSource(e.target.value)}>
                {["Manual", "ControlAssessment", "Vulnerability", "STIG"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Related control (optional)</label>
              <select className="input" value={implementationId} onChange={(e) => setImpl(e.target.value)}>
                <option value="">— none —</option>
                {impls.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.control.controlId}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Scheduled completion</label>
              <input type="date" className="input" value={scheduledCompletion} onChange={(e) => setDue(e.target.value)} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="label">Description</label>
              {weaknessTitle && (
                <button
                  type="button"
                  className="text-xs text-brand-300 hover:underline"
                  onClick={async () => {
                    // Create first so the AI route has a POA&M to read, then draft.
                    if (!createdId) {
                      try {
                        const p = await apiSend<{ id: string }>("/api/poams", "POST", {
                          systemId,
                          weaknessTitle,
                          severity,
                          riskRating: severity,
                          source,
                          implementationId: implementationId || null,
                        });
                        setCreatedId(p.id);
                        onCreated();
                      } catch {
                        return;
                      }
                    }
                    setShowAi(true);
                  }}
                >
                  ✨ AI draft
                </button>
              )}
            </div>
            <textarea
              className="input h-24"
              value={weaknessDescription}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        {createdId && (
          <p className="mt-2 text-xs text-amber-300">
            POA&amp;M created so AI can reference it. Saving below updates its description.
          </p>
        )}
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            {createdId ? "Done" : "Cancel"}
          </button>
          {createdId ? (
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await apiSend(`/api/poams/${createdId}`, "PATCH", { weaknessDescription });
                onCreated();
                onClose();
              }}
            >
              Save description
            </button>
          ) : (
            <button className="btn-primary" disabled={busy}>
              {busy ? "Creating…" : "Create POA&M"}
            </button>
          )}
        </div>

        {showAi && createdId && (
          <AiDraftPanel
            kind="poam_description"
            systemId={systemId}
            poamId={createdId}
            onAccept={(text) => setDescription(text)}
            onClose={() => setShowAi(false)}
          />
        )}
      </form>
    </div>
  );
}
