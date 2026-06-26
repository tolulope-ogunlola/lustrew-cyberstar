"use client";

import { useEffect, useState } from "react";
import { PageHeader, useApi } from "@/components/ui";
import { VulnsPanel } from "@/components/system/VulnsPanel";

type SystemRow = { id: string; name: string; fipsCategory: string };

export default function VulnerabilitiesPage() {
  const { data: systems } = useApi<SystemRow[]>("/api/systems");
  const [systemId, setSystemId] = useState<string | null>(null);

  useEffect(() => {
    if (systems && systems.length && !systemId) setSystemId(systems[0].id);
  }, [systems, systemId]);

  return (
    <div>
      <PageHeader
        title="Vulnerabilities"
        subtitle="Import Nessus/ACAS scans, prioritize, and convert findings to POA&Ms"
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {(systems ?? []).map((s) => (
          <button
            key={s.id}
            onClick={() => setSystemId(s.id)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              s.id === systemId
                ? "border-brand-500 bg-brand-600/15 text-brand-300"
                : "border-ink-700 text-slate-300 hover:bg-ink-800"
            }`}
          >
            {s.name}
            <span className="ml-2 text-xs text-slate-500">{s.fipsCategory}</span>
          </button>
        ))}
      </div>

      {systemId && <VulnsPanel systemId={systemId} />}
    </div>
  );
}
