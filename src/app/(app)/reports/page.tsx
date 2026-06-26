"use client";

import { useEffect, useState } from "react";
import { PageHeader, useApi } from "@/components/ui";
import { Icon } from "@/components/icons";

type SystemRow = { id: string; name: string; fipsCategory: string };

const REPORTS = [
  { type: "executive", label: "Executive Summary", description: "ATO readiness, posture, and key risk indicators" },
  { type: "controls", label: "Control Implementation", description: "NIST 800-53 status, scoping, and evidence coverage" },
  { type: "poam", label: "POA&M Report", description: "Open items, milestones, and aging" },
  { type: "vulnerabilities", label: "Vulnerability Assessment", description: "Findings by severity with remediation priority" },
  { type: "risks", label: "Risk Register", description: "Inherent and residual risk with treatment status" },
] as const;

const FORMATS = [
  { f: "pdf", label: "PDF" },
  { f: "xlsx", label: "XLSX" },
  { f: "csv", label: "CSV" },
] as const;

export default function ReportsPage() {
  const { data: systems } = useApi<SystemRow[]>("/api/systems");
  const [systemId, setSystemId] = useState<string | null>(null);

  useEffect(() => {
    if (systems && systems.length && !systemId) setSystemId(systems[0].id);
  }, [systems, systemId]);

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Generate audit-ready exports for stakeholders and assessors"
      />

      <div className="mb-6 flex flex-wrap gap-2">
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

      <div className="grid gap-4 md:grid-cols-2">
        {REPORTS.map((r) => (
          <div key={r.type} className="card flex items-start gap-4">
            <div className="icon-tile bg-accent-500/15 text-accent-400">
              <Icon name="doc" className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-slate-100">{r.label}</div>
              <p className="mt-0.5 text-sm text-slate-400">{r.description}</p>
              <div className="mt-3 flex gap-2">
                {FORMATS.map((fmt) => (
                  <a
                    key={fmt.f}
                    href={systemId ? `/api/reports?type=${r.type}&systemId=${systemId}&format=${fmt.f}` : undefined}
                    className={`btn-ghost py-1 text-xs ${systemId ? "" : "pointer-events-none opacity-40"}`}
                  >
                    {fmt.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
