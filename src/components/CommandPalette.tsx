"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Hit = { type: string; label: string; sub?: string; href: string };

// Global ⌘K / Ctrl+K quick search across the org's systems, controls, POA&Ms, vulns, risks, policies + pages.
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Open on ⌘K / Ctrl+K, close on Esc.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("cyberstar:open-search", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("cyberstar:open-search", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setHits([]);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Debounced search.
  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (!term) {
      setHits([]);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const json = await res.json();
        setHits(json.results ?? []);
        setActive(0);
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, open]);

  const go = useCallback(
    (hit: Hit) => {
      setOpen(false);
      router.push(hit.href);
    },
    [router],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center bg-black/60 p-4 pt-[12vh]" onMouseDown={() => setOpen(false)}>
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-ink-800 bg-ink-900 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-ink-800 px-4">
          <span className="text-slate-400">⌘</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, hits.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && hits[active]) {
                e.preventDefault();
                go(hits[active]);
              }
            }}
            placeholder="Search systems, controls, POA&Ms, vulnerabilities…"
            className="w-full bg-transparent py-3.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          {loading && <span className="text-xs text-slate-500">…</span>}
        </div>
        <div className="max-h-80 overflow-y-auto py-1">
          {hits.length === 0 && q.trim() && !loading && (
            <div className="px-4 py-6 text-center text-sm text-slate-500">No matches for “{q}”.</div>
          )}
          {hits.length === 0 && !q.trim() && (
            <div className="px-4 py-6 text-center text-sm text-slate-500">Type to search across your organization.</div>
          )}
          {hits.map((hit, i) => (
            <button
              key={`${hit.href}-${i}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(hit)}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${i === active ? "bg-brand-500/15" : ""}`}
            >
              <span className="w-24 shrink-0 text-xs uppercase tracking-wide text-slate-500">{hit.type}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-slate-100">{hit.label}</span>
                {hit.sub && <span className="block truncate text-xs text-slate-500">{hit.sub}</span>}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 border-t border-ink-800 px-4 py-2 text-[11px] text-slate-500">
          <span>enter to open</span>
          <span>↑↓ to navigate</span>
          <span>esc to close</span>
        </div>
      </div>
    </div>
  );
}
