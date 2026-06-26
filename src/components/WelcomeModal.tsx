"use client";

import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { useFocusTrap } from "@/lib/useFocusTrap";

const SEEN_KEY = "cyberstar_welcomed";

const HIGHLIGHTS: { icon: IconName; title: string; body: string }[] = [
  { icon: "shield", title: "Controls & RMF", body: "Track 800-53 implementation and move systems through the RMF lifecycle." },
  { icon: "alert", title: "Findings → POA&Ms", body: "Import scans and STIG checklists, then convert findings to tracked remediation." },
  { icon: "gauge", title: "Posture & reports", body: "Watch readiness on the dashboard and export audit-ready reports." },
];

// One-time welcome shown on first authenticated visit (per browser).
export function WelcomeModal() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (localStorage.getItem(SEEN_KEY) !== "1") setOpen(true);
  }, []);
  useFocusTrap(ref, open);

  function close() {
    localStorage.setItem(SEEN_KEY, "1");
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div ref={ref} role="dialog" aria-modal="true" aria-label="Welcome" className="w-full max-w-lg rounded-2xl border border-ink-700 bg-ink-900 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Icon name="bolt" className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Welcome to CyberStar</h2>
            <p className="text-sm text-slate-400">Your ATO/A&amp;A, RMF, and continuous-monitoring workspace.</p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {HIGHLIGHTS.map((h) => (
            <div key={h.title} className="flex items-start gap-3">
              <div className="icon-tile h-9 w-9 bg-brand-500/15 text-brand-400">
                <Icon name={h.icon} className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-100">{h.title}</div>
                <div className="text-sm text-slate-400">{h.body}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-xs text-slate-400">
          Tip: the <span className="font-medium text-slate-200">Info</span> button (top-right) explains
          whatever page you're on, and the <span className="font-medium text-slate-200">Getting started</span>{" "}
          checklist on your dashboard walks you through setup.
        </div>

        <div className="mt-5 flex justify-end">
          <button className="btn-primary" onClick={close}>Get started</button>
        </div>
      </div>
    </div>
  );
}
