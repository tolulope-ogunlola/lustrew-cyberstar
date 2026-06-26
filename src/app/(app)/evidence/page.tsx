"use client";

import { useEffect, useState } from "react";
import { PageHeader, useApi } from "@/components/ui";
import { EvidenceTab } from "@/components/system/EvidenceTab";

type SystemRow = { id: string; name: string };

export default function EvidencePage() {
  const { data: systems } = useApi<SystemRow[]>("/api/systems");
  const [systemId, setSystemId] = useState<string | null>(null);

  useEffect(() => {
    if (systems && systems.length && !systemId) setSystemId(systems[0].id);
  }, [systems, systemId]);

  return (
    <div>
      <PageHeader title="Evidence Vault" subtitle="Artifacts mapped to control implementations" />

      <div className="mb-5 flex flex-wrap gap-2">
        {(systems ?? []).map((s) => (
          <button
            key={s.id}
            onClick={() => setSystemId(s.id)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              s.id === systemId
                ? "border-brand-500 bg-brand-600/15 text-brand-300"
                : "border-ink-600 text-slate-300 hover:bg-ink-800"
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      {systemId && <EvidenceTab systemId={systemId} />}
    </div>
  );
}
