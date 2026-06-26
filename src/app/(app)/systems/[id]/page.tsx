"use client";

import { use, useState } from "react";
import Link from "next/link";
import { PageHeader, StatusBadge, useApi } from "@/components/ui";
import { ControlsTab } from "@/components/system/ControlsTab";
import { RmfTab } from "@/components/system/RmfTab";
import { EvidenceTab } from "@/components/system/EvidenceTab";
import { PoamsTab } from "@/components/system/PoamsTab";
import { VulnsPanel } from "@/components/system/VulnsPanel";
import { RisksPanel } from "@/components/system/RisksPanel";
import { StigPanel } from "@/components/system/StigPanel";
import { PpsmPanel } from "@/components/system/PpsmPanel";
import { Tooltip } from "@/components/Tooltip";

type SystemDetail = {
  id: string;
  name: string;
  description: string;
  fipsCategory: string;
  frameworks: string[];
  owner: { name: string } | null;
};

const TABS = ["Controls", "RMF", "Evidence", "Vulnerabilities", "STIG", "POA&Ms", "Risks", "PPSM"] as const;
type Tab = (typeof TABS)[number];

const TAB_HELP: Record<Tab, string> = {
  Controls: "Track NIST 800-53 implementation status, scoping, and SSP narratives.",
  RMF: "Advance the system through the 7 RMF lifecycle steps.",
  Evidence: "Upload artifacts and map them to the controls they support.",
  Vulnerabilities: "Import Nessus/ACAS scans, prioritize, and convert findings to POA&Ms.",
  STIG: "Import DISA .ckl checklists and track CAT findings.",
  "POA&Ms": "Plan of Action & Milestones — track weaknesses to remediation.",
  Risks: "Score and treat risks on a 5×5 likelihood × impact matrix.",
  PPSM: "Document ports, protocols, and services with approval status.",
};

export default function SystemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: system, loading } = useApi<SystemDetail>(`/api/systems/${id}`);
  const [tab, setTab] = useState<Tab>("Controls");

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>;
  if (!system) return <p className="text-sm text-red-400">System not found.</p>;

  return (
    <div>
      <Link href="/systems" className="text-xs text-slate-400 hover:text-brand-300">
        ← Systems
      </Link>
      <PageHeader
        title={system.name}
        subtitle={system.description}
        actions={<StatusBadge value={system.fipsCategory} />}
      />

      <div className="mb-5 flex flex-wrap gap-1 text-xs text-slate-400">
        {system.frameworks.map((f) => (
          <span key={f} className="badge bg-ink-700 text-slate-300">
            {f.replaceAll("_", " ")}
          </span>
        ))}
        <span className="ml-2 self-center">Owner: {system.owner?.name ?? "—"}</span>
      </div>

      <div className="mb-5 flex flex-wrap gap-1 border-b border-ink-800">
        {TABS.map((t) => (
          <Tooltip key={t} label={TAB_HELP[t]}>
            <button
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium ${
                tab === t
                  ? "border-b-2 border-brand-500 text-brand-300"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t}
            </button>
          </Tooltip>
        ))}
      </div>

      {tab === "Controls" && <ControlsTab systemId={id} />}
      {tab === "RMF" && <RmfTab systemId={id} />}
      {tab === "Evidence" && <EvidenceTab systemId={id} />}
      {tab === "Vulnerabilities" && <VulnsPanel systemId={id} />}
      {tab === "STIG" && <StigPanel systemId={id} />}
      {tab === "POA&Ms" && <PoamsTab systemId={id} />}
      {tab === "Risks" && <RisksPanel systemId={id} />}
      {tab === "PPSM" && <PpsmPanel systemId={id} />}
    </div>
  );
}
