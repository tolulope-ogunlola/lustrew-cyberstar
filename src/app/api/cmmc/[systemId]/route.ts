import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { withFrameworks } from "@/lib/util";
import { computeSprs, weightFor } from "@/lib/sprs";
import { familyName, CROSSWALK_171_TO_53 } from "@/lib/cmmc";

// GET /api/cmmc/[systemId] — CMMC / 800-171 readiness: SPRS score, family coverage, and gaps.
export async function GET(_req: Request, { params }: { params: Promise<{ systemId: string }> }) {
  return route(async () => {
    const user = await requirePermission("read", "control");
    const { systemId } = await params;

    const system = await prisma.system.findFirst({ where: { id: systemId, orgId: user.orgId } });
    if (!system) throw new HttpError(404, "System not found");
    const sys = withFrameworks(system);
    const fw: string[] = sys.frameworks;
    const level = fw.includes("CMMC_L2") ? "CMMC_L2" : fw.includes("NIST_800_171") ? "NIST_800_171" : fw.includes("CMMC_L1") ? "CMMC_L1" : null;

    const impls = await prisma.controlImplementation.findMany({
      where: { systemId, control: { framework: "NIST_800_171" } },
      include: { control: { select: { controlId: true, family: true, title: true } } },
    });

    const isCmmc = level !== null || impls.length > 0;

    // SPRS over applicable (non-NA) requirements; "met" = fully implemented.
    const applicable = impls.filter((i) => i.scoping !== "NOT_APPLICABLE");
    const sprs = computeSprs(applicable.map((i) => ({ controlId: i.control.controlId, met: i.status === "IMPLEMENTED" })));

    // Coverage by 800-171 family.
    const famMap = new Map<string, { code: string; name: string; total: number; met: number; crosswalk53: string[] }>();
    for (const i of impls) {
      const code = i.control.family;
      const f = famMap.get(code) ?? { code, name: familyName(code), total: 0, met: 0, crosswalk53: CROSSWALK_171_TO_53[code] ?? [] };
      f.total += 1;
      if (i.status === "IMPLEMENTED") f.met += 1;
      famMap.set(code, f);
    }
    const families = [...famMap.values()].sort((a, b) => {
      const na = Number(a.code.split(".")[1]);
      const nb = Number(b.code.split(".")[1]);
      return na - nb;
    });

    // Gap list: not-met requirements, highest SPRS weight first.
    const notMet = applicable
      .filter((i) => i.status !== "IMPLEMENTED")
      .map((i) => ({ controlId: i.control.controlId, title: i.control.title, status: i.status, weight: weightFor(i.control.controlId) }))
      .sort((a, b) => b.weight - a.weight || a.controlId.localeCompare(b.controlId));

    const assets = await prisma.asset.groupBy({ by: ["category"], where: { systemId }, _count: { _all: true } });

    return {
      system: { id: sys.id, name: sys.name, fipsCategory: sys.fipsCategory },
      isCmmc,
      level,
      sprs,
      families,
      notMet,
      assetsByCategory: assets.map((a) => ({ category: a.category, count: a._count._all })),
    };
  });
}
