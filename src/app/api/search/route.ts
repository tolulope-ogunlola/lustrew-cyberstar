import { prisma } from "@/lib/db";
import { requireUser, route } from "@/lib/api";
import { NAV_META, ROLE_NAV, type NavKey } from "@/lib/rbac";
import type { Role } from "@/lib/types";

export type SearchHit = { type: string; label: string; sub?: string; href: string };

// GET /api/search?q=... -> org-scoped, multi-entity quick search for the ⌘K palette.
export async function GET(req: Request) {
  return route(async () => {
    const user = await requireUser();
    const q = (new URL(req.url).searchParams.get("q") || "").trim();
    if (q.length < 1) return { results: [] as SearchHit[] };

    const orgId = user.orgId;
    const take = 5;
    const results: SearchHit[] = [];

    // Pages the current role can navigate to.
    const navKeys = (ROLE_NAV[user.role as Role] ?? []) as NavKey[];
    for (const key of navKeys) {
      const m = NAV_META[key];
      if (m.label.toLowerCase().includes(q.toLowerCase()) || m.subtitle.toLowerCase().includes(q.toLowerCase())) {
        results.push({ type: "Page", label: m.label, sub: m.subtitle, href: m.href });
      }
    }

    const [systems, controls, poams, vulns, risks, policies] = await Promise.all([
      prisma.system.findMany({ where: { orgId, name: { contains: q } }, take, select: { id: true, name: true, fipsCategory: true } }),
      prisma.control.findMany({
        where: { OR: [{ controlId: { contains: q } }, { title: { contains: q } }] },
        take,
        select: { controlId: true, title: true },
      }),
      prisma.poam.findMany({
        where: { system: { orgId }, OR: [{ poamNumber: { contains: q } }, { weaknessTitle: { contains: q } }] },
        take,
        select: { id: true, poamNumber: true, weaknessTitle: true },
      }),
      prisma.vulnerability.findMany({
        where: { system: { orgId }, title: { contains: q } },
        take,
        select: { id: true, title: true, severity: true },
      }),
      prisma.risk.findMany({ where: { system: { orgId }, title: { contains: q } }, take, select: { id: true, title: true } }),
      prisma.policy.findMany({ where: { orgId, title: { contains: q } }, take, select: { id: true, title: true } }),
    ]);

    for (const s of systems) results.push({ type: "System", label: s.name, sub: `${s.fipsCategory} impact`, href: `/systems/${s.id}` });
    for (const c of controls) results.push({ type: "Control", label: c.controlId, sub: c.title, href: "/controls" });
    for (const p of poams) results.push({ type: "POA&M", label: p.poamNumber, sub: p.weaknessTitle, href: "/poams" });
    for (const v of vulns) results.push({ type: "Vulnerability", label: v.title, sub: v.severity, href: "/vulnerabilities" });
    for (const r of risks) results.push({ type: "Risk", label: r.title, href: "/risks" });
    for (const p of policies) results.push({ type: "Policy", label: p.title, href: "/policies" });

    return { results };
  });
}
