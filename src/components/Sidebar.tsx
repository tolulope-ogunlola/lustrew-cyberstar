"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Role } from "@/lib/types";
import { NAV_META, NAV_SECTIONS, ROLE_NAV, ROLE_LABEL, type NavKey, type NavSection } from "@/lib/rbac";
import { Icon } from "./icons";

const SECTION_LABEL: Record<NavSection, string> = {
  COMPLIANCE: "Compliance",
  SYSTEM: "System",
};

export function Sidebar({ role, name }: { role: Role; name: string }) {
  const pathname = usePathname();
  const items: NavKey[] = ROLE_NAV[role];

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-ink-800 bg-ink-900/60">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
          <Icon name="bolt" className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold text-slate-100">CyberStar</div>
          <div className="text-[11px] uppercase tracking-wider text-slate-500">Lustrew Dynamics</div>
        </div>
      </div>

      {/* Nav grouped by section */}
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
        {NAV_SECTIONS.map((section) => {
          const sectionItems = items.filter((k) => NAV_META[k].section === section);
          if (sectionItems.length === 0) return null;
          return (
            <div key={section}>
              <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">
                {SECTION_LABEL[section]}
              </div>
              <div className="space-y-0.5">
                {sectionItems.map((key) => {
                  const meta = NAV_META[key];
                  const active = pathname === meta.href || pathname.startsWith(meta.href + "/");
                  return (
                    <Link
                      key={key}
                      href={meta.href}
                      className={`group flex items-center gap-3 rounded-xl px-3 py-2 transition ${
                        active ? "bg-ink-800 text-slate-100" : "text-slate-400 hover:bg-ink-800/60 hover:text-slate-200"
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                          active ? "bg-brand-600/20 text-brand-300" : "bg-ink-800 text-slate-400 group-hover:text-slate-200"
                        }`}
                      >
                        <Icon name={meta.icon} className="h-[18px] w-[18px]" />
                      </span>
                      <span className="leading-tight">
                        <span className="block text-sm font-medium">{meta.label}</span>
                        <span className="block text-[11px] text-slate-500">{meta.subtitle}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="flex items-center gap-3 border-t border-ink-800 px-4 py-3">
        <Link
          href="/account"
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1 hover:bg-ink-800"
          title="Account settings"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-500/20 text-sm font-semibold text-accent-400">
            {name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-medium text-slate-200">{name}</div>
            <div className="truncate text-[11px] text-slate-500">{ROLE_LABEL[role]}</div>
          </div>
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          title="Sign out"
          className="text-slate-500 transition hover:text-brand-300"
        >
          <Icon name="logout" className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
