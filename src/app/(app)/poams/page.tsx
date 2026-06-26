"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader, StatusBadge, useApi } from "@/components/ui";

type Poam = {
  id: string;
  poamNumber: string;
  weaknessTitle: string;
  severity: string;
  status: string;
  scheduledCompletion: string | null;
  system: { id: string; name: string };
  owner: { name: string } | null;
  implementation: { control: { controlId: string } } | null;
};

function isOverdue(p: Poam) {
  return (
    p.scheduledCompletion != null &&
    new Date(p.scheduledCompletion) < new Date() &&
    !["COMPLETED", "CLOSED", "RISK_ACCEPTED"].includes(p.status)
  );
}

export default function PoamsPage() {
  const { data, loading } = useApi<Poam[]>("/api/poams");
  const [filter, setFilter] = useState<"ALL" | "OPEN" | "OVERDUE">("ALL");

  const rows = (data ?? []).filter((p) => {
    if (filter === "OPEN") return !["COMPLETED", "CLOSED"].includes(p.status);
    if (filter === "OVERDUE") return isOverdue(p);
    return true;
  });

  const overdueCount = (data ?? []).filter(isOverdue).length;

  return (
    <div>
      <PageHeader
        title="POA&M Manager"
        subtitle={`${data?.length ?? 0} items · ${overdueCount} overdue`}
      />

      <div className="mb-4 flex gap-1">
        {(["ALL", "OPEN", "OVERDUE"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md border px-3 py-1 text-xs ${
              f === filter ? "border-brand-500 bg-brand-600/15 text-brand-300" : "border-ink-600 text-slate-300"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-slate-400">Loading…</p>}

      <div className="overflow-hidden rounded-xl border border-ink-700">
        <table className="w-full">
          <thead className="bg-ink-900">
            <tr>
              <th className="th">POA&amp;M</th>
              <th className="th">Weakness</th>
              <th className="th">System</th>
              <th className="th">Severity</th>
              <th className="th">Status</th>
              <th className="th">Due</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800">
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-ink-900/40">
                <td className="td font-mono text-xs text-slate-400">{p.poamNumber}</td>
                <td className="td">
                  <div className="text-slate-100">{p.weaknessTitle}</div>
                  {p.implementation && (
                    <div className="text-xs text-slate-500">{p.implementation.control.controlId}</div>
                  )}
                </td>
                <td className="td text-xs text-slate-400">{p.system.name}</td>
                <td className="td">
                  <StatusBadge value={p.severity} />
                </td>
                <td className="td">
                  <div className="flex flex-col gap-1">
                    <StatusBadge value={p.status} />
                    {isOverdue(p) && <span className="badge bg-red-600/20 text-red-300">OVERDUE</span>}
                  </div>
                </td>
                <td className="td text-xs text-slate-400">
                  {p.scheduledCompletion ? new Date(p.scheduledCompletion).toLocaleDateString() : "—"}
                </td>
                <td className="td text-right">
                  <Link href={`/systems/${p.system.id}`} className="text-xs text-brand-300 hover:underline">
                    Manage
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
