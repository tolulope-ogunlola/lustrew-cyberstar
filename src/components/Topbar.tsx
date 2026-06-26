"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_META, type NavKey } from "@/lib/rbac";
import { Icon } from "./icons";
import { ThemeToggle } from "./ThemeToggle";
import { HelpPanel } from "./HelpPanel";

// Resolve the current page to its nav key + label (used for the breadcrumb and contextual help).
function currentNav(pathname: string): { key: string | null; label: string } {
  if (pathname.startsWith("/account")) return { key: "account", label: "Account" };
  const match = (Object.keys(NAV_META) as NavKey[]).find((k) => {
    const href = NAV_META[k].href;
    return pathname === href || pathname.startsWith(href + "/");
  });
  return match ? { key: match, label: NAV_META[match].label } : { key: "dashboard", label: "Overview" };
}

export function Topbar() {
  const pathname = usePathname();
  const { key: navKey, label } = currentNav(pathname);
  const [unread, setUnread] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);

  // Poll the unread count for the bell badge (light cadence).
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/notifications?unread=1")
        .then((r) => (r.ok ? r.json() : { unreadCount: 0 }))
        .then((d) => alive && setUnread(d.unreadCount ?? 0))
        .catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [pathname]);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-ink-800 bg-ink-950/80 px-6 backdrop-blur">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-500">CyberStar</span>
        <span className="text-slate-600">›</span>
        <span className="font-semibold text-slate-100">{label}</span>
      </div>
      <div className="flex items-center gap-2 text-slate-400">
        <Link href="/notifications" className="relative flex h-8 w-8 items-center justify-center rounded-lg hover:bg-ink-800" title="Notifications">
          <Icon name="bell" className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Link>
        <ThemeToggle />
        <button
          onClick={() => setHelpOpen(true)}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs hover:bg-ink-800"
          title="How to use this page"
        >
          <Icon name="info" className="h-4 w-4" />
          Info
        </button>
      </div>

      <HelpPanel open={helpOpen} helpKey={navKey} onClose={() => setHelpOpen(false)} />
    </header>
  );
}
