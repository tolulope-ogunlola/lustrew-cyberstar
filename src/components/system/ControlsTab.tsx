"use client";

import { useMemo, useState } from "react";
import { StatusBadge, apiSend, useApi } from "@/components/ui";
import { AiDraftPanel } from "@/components/AiDraftPanel";

type Impl = {
  id: string;
  status: string;
  scoping: string;
  narrative: string;
  providerName: string;
  owner: { name: string } | null;
  _count: { evidenceLinks: number };
  control: { controlId: string; family: string; title: string; text: string };
};

const STATUSES = [
  "NOT_IMPLEMENTED",
  "PLANNED",
  "PARTIALLY_IMPLEMENTED",
  "IMPLEMENTED",
  "RISK_ACCEPTED",
];
const SCOPINGS = ["APPLICABLE", "NOT_APPLICABLE", "INHERITED", "HYBRID", "COMPENSATING"];

export function ControlsTab({ systemId }: { systemId: string }) {
  const { data, loading, refetch } = useApi<Impl[]>(`/api/controls?systemId=${systemId}`);
  const [family, setFamily] = useState("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);

  const families = useMemo(
    () => ["ALL", ...Array.from(new Set((data ?? []).map((i) => i.control.family)))],
    [data]
  );
  const rows = (data ?? []).filter((i) => family === "ALL" || i.control.family === family);

  if (loading) return <p className="text-sm text-slate-400">Loading controls…</p>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1">
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

      <div className="overflow-hidden rounded-xl border border-ink-700">
        <table className="w-full">
          <thead className="bg-ink-900">
            <tr>
              <th className="th">Control</th>
              <th className="th">Status</th>
              <th className="th">Scoping</th>
              <th className="th">Evidence</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800">
            {rows.map((impl) => (
              <ControlRow
                key={impl.id}
                impl={impl}
                systemId={systemId}
                expanded={expanded === impl.id}
                onToggle={() => setExpanded(expanded === impl.id ? null : impl.id)}
                onSaved={refetch}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ControlRow({
  impl,
  systemId,
  expanded,
  onToggle,
  onSaved,
}: {
  impl: Impl;
  systemId: string;
  expanded: boolean;
  onToggle: () => void;
  onSaved: () => void;
}) {
  const [narrative, setNarrative] = useState(impl.narrative);
  const [status, setStatus] = useState(impl.status);
  const [scoping, setScoping] = useState(impl.scoping);
  const [providerName, setProviderName] = useState(impl.providerName ?? "");
  const [showAi, setShowAi] = useState(false);
  const [saving, setSaving] = useState(false);

  const isInherited = scoping === "INHERITED" || scoping === "HYBRID";

  async function save() {
    setSaving(true);
    try {
      await apiSend(`/api/controls/${impl.id}`, "PATCH", { status, scoping, narrative, providerName: isInherited ? providerName : "" });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <tr className="cursor-pointer hover:bg-ink-900/40" onClick={onToggle}>
        <td className="td">
          <div className="font-medium text-slate-100">{impl.control.controlId}</div>
          <div className="text-xs text-slate-500">{impl.control.title}</div>
        </td>
        <td className="td">
          <StatusBadge value={impl.status} />
        </td>
        <td className="td text-xs text-slate-400">{impl.scoping.replaceAll("_", " ")}</td>
        <td className="td text-xs text-slate-400">{impl._count.evidenceLinks} linked</td>
        <td className="td text-right text-xs text-brand-300">{expanded ? "Close" : "Edit"}</td>
      </tr>
      {expanded && (
        <tr className="bg-ink-900/40">
          <td className="td" colSpan={5}>
            <p className="mb-3 text-xs text-slate-400">{impl.control.text}</p>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="label">Implementation status</label>
                <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Scoping</label>
                <select className="input" value={scoping} onChange={(e) => setScoping(e.target.value)}>
                  {SCOPINGS.map((s) => (
                    <option key={s} value={s}>
                      {s.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              {isInherited && (
                <div className="md:col-span-2">
                  <label className="label">Common control provider</label>
                  <input
                    className="input"
                    placeholder="e.g. AWS GovCloud, Agency Shared Services"
                    value={providerName}
                    onChange={(e) => setProviderName(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-slate-500">Who provides this inherited/hybrid control. Recorded in the SSP and OSCAL export as control origination.</p>
                </div>
              )}
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between">
                <label className="label">Implementation statement (SSP narrative)</label>
                <button type="button" className="text-xs text-brand-300 hover:underline" onClick={() => setShowAi(true)}>
                  ✨ AI draft
                </button>
              </div>
              <textarea className="input h-32" value={narrative} onChange={(e) => setNarrative(e.target.value)} />
            </div>
            <div className="mt-3 flex justify-end">
              <button className="btn-primary" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save control"}
              </button>
            </div>
          </td>
        </tr>
      )}
      {showAi && (
        <AiDraftPanel
          kind="control_narrative"
          systemId={systemId}
          implementationId={impl.id}
          onAccept={(text) => setNarrative(text)}
          onClose={() => setShowAi(false)}
        />
      )}
    </>
  );
}
