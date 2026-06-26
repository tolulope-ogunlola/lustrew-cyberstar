"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, StatusBadge, apiSend, useApi } from "@/components/ui";
import { Icon } from "@/components/icons";

type Notification = {
  id: string;
  systemId: string | null;
  systemName: string | null;
  category: string;
  severity: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
};

const SEVERITY_ICON: Record<string, "alert" | "bell" | "info"> = {
  CRITICAL: "alert",
  WARNING: "bell",
  INFO: "info",
};

const SEVERITY_TINT: Record<string, string> = {
  CRITICAL: "bg-red-500/15 text-red-300",
  WARNING: "bg-amber-500/15 text-amber-300",
  INFO: "bg-sky-500/15 text-sky-300",
};

export default function NotificationsPage() {
  const { data, loading, refetch } = useApi<{ items: Notification[]; unreadCount: number }>("/api/notifications");
  const [running, setRunning] = useState(false);
  const [ran, setRan] = useState(false);

  // Refresh the rule output once when the center opens so it reflects current state.
  useEffect(() => {
    if (ran) return;
    setRan(true);
    setRunning(true);
    apiSend("/api/notifications/run", "POST")
      .then(() => refetch())
      .finally(() => setRunning(false));
  }, [ran, refetch]);

  const items = data?.items ?? [];

  async function markAll() {
    await apiSend("/api/notifications/read", "POST", { all: true });
    refetch();
  }
  async function markOne(id: string) {
    await apiSend("/api/notifications/read", "POST", { id });
    refetch();
  }
  async function runNow() {
    setRunning(true);
    await apiSend("/api/notifications/run", "POST");
    await refetch();
    setRunning(false);
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Continuous-monitoring alerts and reminders"
        actions={
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={runNow} disabled={running}>
              {running ? "Checking…" : "Run checks"}
            </button>
            <button className="btn-ghost" onClick={markAll} disabled={!items.some((i) => !i.isRead)}>
              Mark all read
            </button>
          </div>
        }
      />

      {(loading || running) && items.length === 0 && <p className="text-sm text-slate-400">Loading…</p>}
      {!loading && !running && items.length === 0 && (
        <div className="card text-sm text-emerald-300">All clear — no open alerts across your systems.</div>
      )}

      <div className="space-y-2">
        {items.map((n) => (
          <div
            key={n.id}
            className={`card flex items-start gap-4 ${n.isRead ? "opacity-60" : ""}`}
          >
            <div className={`icon-tile ${SEVERITY_TINT[n.severity] ?? "bg-ink-800 text-slate-400"}`}>
              <Icon name={SEVERITY_ICON[n.severity] ?? "bell"} className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <StatusBadge value={n.severity} />
                <span className="text-xs text-slate-500">{n.category.replaceAll("_", " ")}</span>
                {!n.isRead && <span className="h-2 w-2 rounded-full bg-brand-400" />}
              </div>
              <div className="mt-1 font-medium text-slate-100">{n.title}</div>
              <div className="text-sm text-slate-400">{n.body}</div>
              <div className="mt-1 text-xs text-slate-500">
                {n.systemName}
                {n.systemId && (
                  <>
                    {" · "}
                    <Link href={`/systems/${n.systemId}`} className="text-brand-300 hover:underline">
                      Open system
                    </Link>
                  </>
                )}
              </div>
            </div>
            {!n.isRead && (
              <button className="text-xs text-slate-400 hover:text-brand-300" onClick={() => markOne(n.id)}>
                Mark read
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
