"use client";

import { useState } from "react";
import { PageHeader, StatusBadge, apiSend, useApi } from "@/components/ui";
import {
  DATA_SENSITIVITY,
  VENDOR_CRITICALITY,
  VENDOR_STATUS,
  REVIEW_CADENCE,
} from "@/lib/validation";

type Vendor = {
  id: string;
  vendorNumber: string;
  name: string;
  dataSensitivity: string;
  criticality: string;
  status: string;
  riskRating: string;
  reviewCadence: string;
  nextReviewDate: string | null;
  hasDpa: boolean;
  reviewOverdue: boolean;
  owner: { name: string } | null;
  _count: { reviews: number; documents: number };
};

export default function VendorsPage() {
  const { data, loading, refetch } = useApi<Vendor[]>("/api/vendors");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Vendor | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function setStatus(id: string, status: string) {
    await apiSend(`/api/vendors/${id}`, "PATCH", { status });
    refetch();
  }
  async function markReviewed(v: Vendor) {
    setBusyId(v.id);
    try {
      const review = await apiSend<{ id: string }>(`/api/vendors/${v.id}/reviews`, "POST", { reviewType: "PERIODIC" });
      await apiSend(`/api/vendor-reviews/${review.id}`, "PATCH", { status: "COMPLETED" });
      await refetch();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Vendor Risk"
        subtitle="Third-party inventory, security reviews, and DPA tracking"
        actions={<button className="btn-primary" onClick={() => setOpen(true)}>New vendor</button>}
      />

      {loading && <p className="text-sm text-slate-400">Loading…</p>}

      <div className="space-y-2">
        {(data ?? []).map((v) => (
          <div key={v.id} className="card flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-[220px]">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-100">{v.name}</span>
                <StatusBadge value={v.riskRating} />
                {v.hasDpa && <span className="badge bg-ink-700 text-slate-300">DPA</span>}
                {v.reviewOverdue && <span className="badge bg-red-500/15 text-red-300">review overdue</span>}
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                {v.vendorNumber} · {v.dataSensitivity} · {v.criticality} · {v._count.reviews} review(s) · {v._count.documents} doc(s)
                {v.nextReviewDate && ` · next review ${new Date(v.nextReviewDate).toLocaleDateString()}`}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select className="input max-w-[150px] py-1 text-xs" value={v.status} onChange={(e) => setStatus(v.id, e.target.value)}>
                {VENDOR_STATUS.map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}
              </select>
              <button className="btn-ghost py-1 text-xs disabled:opacity-50" disabled={busyId === v.id} onClick={() => markReviewed(v)}>
                Mark reviewed
              </button>
              <button className="btn-ghost py-1 text-xs" onClick={() => setEdit(v)}>Edit</button>
            </div>
          </div>
        ))}
        {data && data.length === 0 && <p className="text-sm text-slate-400">No vendors yet.</p>}
      </div>

      {(open || edit) && (
        <VendorModal vendor={edit} onClose={() => { setOpen(false); setEdit(null); }} onSaved={refetch} />
      )}
    </div>
  );
}

function VendorModal({ vendor, onClose, onSaved }: { vendor: Vendor | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    name: vendor?.name ?? "",
    dataSensitivity: vendor?.dataSensitivity ?? "NONE",
    criticality: vendor?.criticality ?? "MODERATE",
    status: vendor?.status ?? "PROSPECTIVE",
    reviewCadence: vendor?.reviewCadence ?? "ANNUAL",
    hasDpa: vendor?.hasDpa ?? false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f, v: string | boolean) => setF((c) => ({ ...c, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (vendor) await apiSend(`/api/vendors/${vendor.id}`, "PATCH", f);
      else await apiSend("/api/vendors", "POST", f);
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
        <h3 className="mb-4 text-lg font-semibold text-slate-100">{vendor ? "Edit vendor" : "New vendor"}</h3>
        <div className="space-y-3">
          <div>
            <label className="label">Name</label>
            <input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Data sensitivity</label>
              <select className="input" value={f.dataSensitivity} onChange={(e) => set("dataSensitivity", e.target.value)}>
                {DATA_SENSITIVITY.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Criticality</label>
              <select className="input" value={f.criticality} onChange={(e) => set("criticality", e.target.value)}>
                {VENDOR_CRITICALITY.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={f.status} onChange={(e) => set("status", e.target.value)}>
                {VENDOR_STATUS.map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Review cadence</label>
              <select className="input" value={f.reviewCadence} onChange={(e) => set("reviewCadence", e.target.value)}>
                {REVIEW_CADENCE.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={f.hasDpa} onChange={(e) => set("hasDpa", e.target.checked)} />
            Data Processing Agreement (DPA) on file
          </label>
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : vendor ? "Save" : "Create vendor"}</button>
        </div>
      </form>
    </div>
  );
}
