"use client";

import { useCallback, useEffect, useState } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  IMPLEMENTED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  RISK_ACCEPTED: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  PARTIALLY_IMPLEMENTED: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
  PLANNED: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  NOT_IMPLEMENTED: "bg-slate-500/15 text-slate-300",
  COMPLETE: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  IN_PROGRESS: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  BLOCKED: "bg-red-500/15 text-red-700 dark:text-red-300",
  NOT_STARTED: "bg-slate-500/15 text-slate-300",
  OPEN: "bg-red-500/15 text-red-700 dark:text-red-300",
  PENDING_REVIEW: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  COMPLETED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  CLOSED: "bg-slate-500/15 text-slate-300",
  CRITICAL: "bg-red-600/20 text-red-700 dark:text-red-300",
  HIGH: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  MODERATE: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
  MEDIUM: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
  LOW: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  INFO: "bg-slate-500/15 text-slate-300",
  // Vulnerability priority + state
  IMMEDIATE: "bg-red-600/20 text-red-700 dark:text-red-300",
  REMEDIATED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  FALSE_POSITIVE: "bg-slate-500/15 text-slate-400",
  // User status
  ACTIVE: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  INACTIVE: "bg-slate-500/15 text-slate-400",
  // Notification severity
  WARNING: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  // STIG severity + status
  CAT_I: "bg-red-600/20 text-red-700 dark:text-red-300",
  CAT_II: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  CAT_III: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
  NOT_A_FINDING: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  NOT_REVIEWED: "bg-slate-500/15 text-slate-300",
  // PPSM + policy status
  APPROVED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  PENDING: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  DENIED: "bg-red-500/15 text-red-700 dark:text-red-300",
  DRAFT: "bg-slate-500/15 text-slate-300",
  UNDER_REVIEW: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  EXPIRED: "bg-red-500/15 text-red-700 dark:text-red-300",
  // Evidence approval workflow
  SUBMITTED: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  REJECTED: "bg-red-500/15 text-red-700 dark:text-red-300",
  // CCM check results
  PASS: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  FAIL: "bg-red-500/15 text-red-700 dark:text-red-300",
  ERROR: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
};

export function StatusBadge({ value }: { value: string }) {
  const color = STATUS_COLORS[value] ?? "bg-ink-700 text-slate-300";
  return <span className={`badge ${color}`}>{value.replaceAll("_", " ")}</span>;
}

export function ScoreGauge({
  label,
  value,
  suffix = "",
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  const color =
    value >= 75
      ? "text-emerald-700 dark:text-emerald-300"
      : value >= 50
        ? "text-yellow-700 dark:text-yellow-300"
        : "text-red-700 dark:text-red-300";
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-1 text-3xl font-bold ${color}`}>
        {value}
        <span className="text-base text-slate-500">{suffix}</span>
      </div>
    </div>
  );
}

/** Tiny client data hook with refetch — keeps view components terse. */
export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error((await res.json()).error || res.statusText);
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, error, loading, refetch };
}

export async function apiSend<T>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body == null ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg.error || res.statusText);
  }
  return res.json();
}
