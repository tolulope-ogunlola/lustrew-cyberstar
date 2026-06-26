"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui";
import { CROSSWALKS } from "@/lib/crosswalks";

export default function CrosswalksPage() {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const rows = CROSSWALKS.filter(
    (r) =>
      term === "" ||
      r.family.toLowerCase().includes(term) ||
      r.familyName.toLowerCase().includes(term) ||
      r.cmmc.toLowerCase().includes(term) ||
      r.iso27001.toLowerCase().includes(term) ||
      r.soc2.toLowerCase().includes(term),
  );

  return (
    <div>
      <PageHeader
        title="Framework Crosswalks"
        subtitle="Map NIST 800-53 control families to CMMC 2.0, ISO/IEC 27001:2022, and SOC 2"
      />

      <div className="card mb-4 border-brand-500/30 bg-brand-600/5">
        <p className="text-sm text-slate-300">
          These family-level mappings help scope reciprocity and reuse of evidence across frameworks. They are directional
          aids — confirm individual control applicability before relying on them for an authorization decision.
        </p>
      </div>

      <input
        className="input mb-4 max-w-xs"
        placeholder="Search families or references…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="overflow-hidden rounded-xl border border-ink-700">
        <table className="w-full">
          <thead className="bg-ink-900">
            <tr>
              <th className="th">NIST 800-53 Family</th>
              <th className="th">CMMC 2.0 (L2)</th>
              <th className="th">ISO/IEC 27001:2022</th>
              <th className="th">SOC 2 (TSC)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800">
            {rows.map((r) => (
              <tr key={r.family}>
                <td className="td">
                  <span className="font-semibold text-slate-100">{r.family}</span>
                  <span className="block text-xs text-slate-400">{r.familyName}</span>
                </td>
                <td className="td text-sm text-slate-300">{r.cmmc}</td>
                <td className="td text-sm text-slate-300">{r.iso27001}</td>
                <td className="td text-sm text-slate-300">{r.soc2}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && <p className="mt-4 text-sm text-slate-400">No families match “{q}”.</p>}
    </div>
  );
}
