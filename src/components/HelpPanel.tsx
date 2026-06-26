"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GETTING_STARTED, HELP, type HelpEntry } from "@/lib/help";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { Icon } from "./icons";

export function HelpPanel({
  open,
  helpKey,
  onClose,
}: {
  open: boolean;
  helpKey: string | null;
  onClose: () => void;
}) {
  const [showGuide, setShowGuide] = useState(false);
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => setMounted(true), []);
  useFocusTrap(panelRef, open && mounted);

  // Close on Escape; reset the getting-started toggle when reopened for a new page.
  useEffect(() => {
    if (!open) return;
    setShowGuide(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, helpKey, onClose]);

  if (!open || !mounted) return null;

  const entry: HelpEntry = (helpKey && HELP[helpKey]) || GETTING_STARTED;
  const content = showGuide ? GETTING_STARTED : entry;

  // Portal to <body> so the drawer is positioned against the viewport, not the topbar's
  // backdrop-blur header (a backdrop-filter ancestor would otherwise clip `position: fixed`).
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Help"
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-ink-800 bg-ink-900 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-ink-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <Icon name="info" className="h-5 w-5 text-brand-400" />
            <h2 className="text-sm font-semibold text-slate-100">Help · {content.title}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200" aria-label="Close help">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-sm text-slate-300">{content.intro}</p>
          {content.sections.map((s) => (
            <div key={s.heading} className="mt-5">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{s.heading}</div>
              <ul className="space-y-1.5">
                {s.items.map((it, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-300">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-ink-800 px-5 py-3">
          <button
            onClick={() => setShowGuide((v) => !v)}
            className="text-xs font-medium text-brand-300 hover:underline"
          >
            {showGuide ? "← Back to this page" : "New here? Read Getting started →"}
          </button>
        </div>
      </aside>
    </div>,
    document.body
  );
}
