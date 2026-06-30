"use client";

import { useState } from "react";
import { PageHeader, StatusBadge, apiSend, useApi } from "@/components/ui";
import { PERSONNEL_TYPE, PERSONNEL_STATUS, BG_CHECK_STATUS } from "@/lib/validation";
import { PersonnelDetail } from "@/components/personnel/PersonnelDetail";

type Person = {
  id: string;
  fullName: string;
  personnelType: string;
  department: string;
  status: string;
  bgCheckStatus: string;
  mfaEnabled: boolean | null;
  trainingCount: number;
  accessReviewCount: number;
  onboardingOpen: number;
  compliance: "COMPLIANT" | "AT_RISK" | "NON_COMPLIANT";
};

const COMPLIANCE_BADGE: Record<string, string> = {
  COMPLIANT: "bg-emerald-500/15 text-emerald-300",
  AT_RISK: "bg-amber-500/15 text-amber-300",
  NON_COMPLIANT: "bg-red-500/15 text-red-300",
};

export default function PersonnelPage() {
  const { data, loading, refetch } = useApi<Person[]>("/api/personnel");
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        title="Personnel Compliance"
        subtitle="Training, access reviews, onboarding/offboarding, and background checks"
        actions={<button className="btn-primary" onClick={() => setOpen(true)}>Add person</button>}
      />

      {loading && <p className="text-sm text-slate-400">Loading…</p>}

      <div className="space-y-2">
        {(data ?? []).map((p) => (
          <div key={p.id} className="card flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-[220px]">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-100">{p.fullName}</span>
                <span className={`badge ${COMPLIANCE_BADGE[p.compliance]}`}>{p.compliance.replaceAll("_", " ")}</span>
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                {p.personnelType} · {p.department || "—"} · MFA {p.mfaEnabled === null ? "N/A" : p.mfaEnabled ? "on" : "off"} ·
                {" "}{p.trainingCount} training · {p.accessReviewCount} review(s) · {p.onboardingOpen} open task(s)
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge value={p.status} />
              <button className="btn-ghost py-1 text-xs" onClick={() => setDetailId(p.id)}>Manage</button>
            </div>
          </div>
        ))}
        {data && data.length === 0 && <p className="text-sm text-slate-400">No personnel yet.</p>}
      </div>

      {open && <PersonModal onClose={() => setOpen(false)} onSaved={refetch} />}
      {detailId && (
        <PersonnelDetail
          personId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={refetch}
        />
      )}
    </div>
  );
}

function PersonModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    fullName: "",
    email: "",
    personnelType: "EMPLOYEE",
    department: "",
    jobTitle: "",
    status: "ACTIVE",
    bgCheckStatus: "NOT_STARTED",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f, v: string) => setF((c) => ({ ...c, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiSend("/api/personnel", "POST", f);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form onSubmit={submit} className="w-full max-w-lg rounded-xl border border-ink-700 bg-ink-900 p-5">
        <h3 className="mb-4 text-lg font-semibold text-slate-100">Add person</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Full name</label>
              <input className="input" value={f.fullName} onChange={(e) => set("fullName", e.target.value)} required />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="optional" />
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input" value={f.personnelType} onChange={(e) => set("personnelType", e.target.value)}>
                {PERSONNEL_TYPE.map((t) => <option key={t} value={t}>{t.replaceAll("_", " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={f.status} onChange={(e) => set("status", e.target.value)}>
                {PERSONNEL_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Department</label>
              <input className="input" value={f.department} onChange={(e) => set("department", e.target.value)} />
            </div>
            <div>
              <label className="label">Job title</label>
              <input className="input" value={f.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} />
            </div>
            <div>
              <label className="label">Background check</label>
              <select className="input" value={f.bgCheckStatus} onChange={(e) => set("bgCheckStatus", e.target.value)}>
                {BG_CHECK_STATUS.map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}
              </select>
            </div>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Add person"}</button>
        </div>
      </form>
    </div>
  );
}
