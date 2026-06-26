"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useApi } from "@/components/ui";
import { Icon } from "@/components/icons";

type Status = {
  hasSystem: boolean;
  hasImplementedControl: boolean;
  hasEvidence: boolean;
  hasScan: boolean;
  hasPoam: boolean;
};

const STEPS: { key: keyof Status; label: string; href: string; cta: string }[] = [
  { key: "hasSystem", label: "Create a system", href: "/systems", cta: "Add system" },
  { key: "hasImplementedControl", label: "Set a control's implementation status", href: "/systems", cta: "Open controls" },
  { key: "hasEvidence", label: "Upload evidence and map it to a control", href: "/evidence", cta: "Add evidence" },
  { key: "hasScan", label: "Import a vulnerability or STIG scan", href: "/vulnerabilities", cta: "Import scan" },
  { key: "hasPoam", label: "Track a finding as a POA&M", href: "/poams", cta: "Open POA&Ms" },
];

const DISMISS_KEY = "cyberstar_onboarding_dismissed";

export function GettingStarted() {
  const { data } = useApi<Status>("/api/onboarding/status");
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (dismissed || !data) return null;

  const done = STEPS.filter((s) => data[s.key]).length;
  if (done === STEPS.length) return null; // fully onboarded — hide automatically

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  return (
    <div className="mb-6 card border-brand-500/30">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Icon name="bolt" className="h-4 w-4 text-brand-400" />
            <h2 className="text-sm font-semibold text-slate-100">Getting started</h2>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            {done} of {STEPS.length} complete — finish setup to light up your dashboard.
          </p>
        </div>
        <button onClick={dismiss} className="text-xs text-slate-400 hover:text-slate-200">Dismiss</button>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
        <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${(done / STEPS.length) * 100}%` }} />
      </div>

      <ul className="mt-4 space-y-2">
        {STEPS.map((s) => {
          const complete = data[s.key];
          return (
            <li key={s.key} className="flex items-center gap-3">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  complete ? "border-emerald-500 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" : "border-ink-600 text-transparent"
                }`}
              >
                <Icon name="check" className="h-3 w-3" />
              </span>
              <span className={`flex-1 text-sm ${complete ? "text-slate-500 line-through" : "text-slate-200"}`}>{s.label}</span>
              {!complete && (
                <Link href={s.href} className="btn-ghost py-1 text-xs">{s.cta}</Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
