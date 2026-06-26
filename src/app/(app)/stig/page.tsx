"use client";

import { useEffect, useState } from "react";
import { PageHeader, useApi } from "@/components/ui";
import { StigPanel } from "@/components/system/StigPanel";

type SystemRow = { id: string; name: string; fipsCategory: string };

export default function StigPage() {
  const { data: systems } = useApi<SystemRow[]>("/api/systems");
  const [systemId, setSystemId] = useState<string | null>(null);
  useEffect(() => {
    if (systems && systems.length && !systemId) setSystemId(systems[0].id);
  }, [systems, systemId]);

  return (
    <div>
      <PageHeader title="STIG Compliance" subtitle="Import DISA .ckl checklists, track findings, and convert to POA&Ms" />
      <div className="mb-5 flex flex-wrap gap-2">
        {(systems ?? []).map((s) => (
          <button
            key={s.id}
            onClick={() => setSystemId(s.id)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${s.id === systemId ? "border-brand-500 bg-brand-600/15 text-brand-300" : "border-ink-700 text-slate-300 hover:bg-ink-800"}`}
          >
            {s.name}
            <span className="ml-2 text-xs text-slate-500">{s.fipsCategory}</span>
          </button>
        ))}
      </div>
      {systemId && <StigPanel systemId={systemId} />}
    </div>
  );
}
