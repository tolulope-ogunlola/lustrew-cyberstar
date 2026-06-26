"use client";

import { useMemo, useState } from "react";
import { PageHeader, useApi } from "@/components/ui";

type Control = {
  id: string;
  controlId: string;
  family: string;
  title: string;
  text: string;
  baseline: string;
};

export default function ControlsCatalogPage() {
  const { data, loading } = useApi<Control[]>("/api/controls");
  const [family, setFamily] = useState("ALL");
  const [q, setQ] = useState("");

  const families = useMemo(
    () => ["ALL", ...Array.from(new Set((data ?? []).map((c) => c.family)))],
    [data]
  );
  const rows = (data ?? []).filter(
    (c) =>
      (family === "ALL" || c.family === family) &&
      (q === "" ||
        c.controlId.toLowerCase().includes(q.toLowerCase()) ||
        c.title.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div>
      <PageHeader
        title="NIST SP 800-53 Control Catalog"
        subtitle={`${data?.length ?? 0} controls preloaded across ${families.length - 1} families`}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          className="input max-w-xs"
          placeholder="Search controls…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex flex-wrap gap-1">
          {families.map((f) => (
            <button
              key={f}
              onClick={() => setFamily(f)}
              className={`rounded-md border px-2 py-1 text-xs ${
                f === family ? "border-brand-500 bg-brand-600/15 text-brand-300" : "border-ink-600 text-slate-300"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-sm text-slate-400">Loading…</p>}

      <div className="space-y-2">
        {rows.map((c) => (
          <div key={c.id} className="card">
            <div className="flex items-center justify-between">
              <div className="font-medium text-slate-100">
                {c.controlId} · {c.title}
              </div>
              <span className="badge bg-ink-700 text-slate-300">{c.baseline}</span>
            </div>
            <p className="mt-1 text-sm text-slate-400">{c.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
