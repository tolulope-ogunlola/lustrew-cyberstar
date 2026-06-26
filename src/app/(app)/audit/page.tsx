"use client";

import { useState } from "react";
import { PageHeader, useApi } from "@/components/ui";

type AuditEvent = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: { name: string; role: string } | null;
};

type Page = { items: AuditEvent[]; total: number; page: number; pageSize: number; pages: number };

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const { data, loading, error } = useApi<Page>(`/api/audit?page=${page}&pageSize=50`);

  return (
    <div>
      <PageHeader
        title="Audit Log"
        subtitle={data ? `${data.total} events · append-only` : "Append-only record of platform activity"}
      />

      {error && <p className="text-sm text-red-400">{error}</p>}
      {loading && <p className="text-sm text-slate-400">Loading…</p>}

      <div className="overflow-hidden rounded-xl border border-ink-700">
        <table className="w-full">
          <thead className="bg-ink-900">
            <tr>
              <th className="th">Time</th>
              <th className="th">Actor</th>
              <th className="th">Action</th>
              <th className="th">Entity</th>
              <th className="th">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800">
            {(data?.items ?? []).map((e) => (
              <tr key={e.id}>
                <td className="td text-xs text-slate-400">{new Date(e.createdAt).toLocaleString()}</td>
                <td className="td text-xs">
                  {e.actor ? (
                    <>
                      <span className="text-slate-200">{e.actor.name}</span>
                      <span className="ml-1 text-slate-500">({e.actor.role})</span>
                    </>
                  ) : (
                    <span className="text-slate-500">system</span>
                  )}
                </td>
                <td className="td">
                  <span className="badge bg-ink-700 text-slate-300">{e.action}</span>
                </td>
                <td className="td text-xs text-slate-400">{e.entityType}</td>
                <td className="td text-xs text-slate-500">{e.metadata ? JSON.stringify(e.metadata) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-slate-500">Page {data.page} of {data.pages}</span>
          <div className="flex gap-2">
            <button className="btn-ghost py-1" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <button className="btn-ghost py-1" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
