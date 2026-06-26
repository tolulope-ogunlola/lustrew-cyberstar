"use client";

import { type ReactNode } from "react";

// Lightweight CSS-only tooltip (no positioning library). Appears on hover and keyboard focus.
export function Tooltip({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`group/tt relative inline-flex ${className}`}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-40 mt-2 w-max max-w-[16rem] -translate-x-1/2 translate-y-1 rounded-lg border border-ink-700 bg-ink-900 px-2.5 py-1.5 text-xs font-normal normal-case tracking-normal text-slate-200 opacity-0 shadow-lg transition-opacity duration-150 group-hover/tt:opacity-100 group-focus-within/tt:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}
