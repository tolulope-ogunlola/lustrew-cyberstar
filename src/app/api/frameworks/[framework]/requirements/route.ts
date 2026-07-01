import { prisma } from "@/lib/db";
import { HttpError, requireUser, route } from "@/lib/api";
import { FRAMEWORK_CATALOG_LABEL, isCatalogKey } from "@/lib/frameworks";
import { equivalentControls } from "@/lib/crosswalks";

/**
 * GET /api/frameworks/[framework]/requirements
 * GET /api/frameworks/[framework]/requirements?systemId=X
 *
 * Returns the framework's control catalog with per-control evidence requirements, and — when a
 * systemId is supplied — that system's implementation status and a fulfillment view (which
 * requirements have evidence collected). Reads are allowed for any authenticated user (the
 * catalog is reference data; system data is org-scoped).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ framework: string }> }
) {
  return route(async () => {
    const user = await requireUser();
    const { framework } = await params;
    if (!isCatalogKey(framework)) throw new HttpError(404, "Unknown framework catalog");

    const systemId = new URL(req.url).searchParams.get("systemId");

    const [controls, requirements] = await Promise.all([
      prisma.control.findMany({ where: { framework }, orderBy: { controlId: "asc" } }),
      prisma.evidenceRequirement.findMany({ where: { framework }, orderBy: { controlId: "asc" } }),
    ]);

    // Group requirements by control id.
    const reqsByControl = new Map<string, typeof requirements>();
    for (const r of requirements) {
      const list = reqsByControl.get(r.controlId) ?? [];
      list.push(r);
      reqsByControl.set(r.controlId, list);
    }

    // Per-system implementation + evidence presence, keyed by catalog controlId.
    const implByControlId = new Map<string, { status: string; scoping: string; evidenceCount: number }>();
    if (systemId) {
      const system = await prisma.system.findFirst({ where: { id: systemId, orgId: user.orgId }, select: { id: true } });
      if (!system) throw new HttpError(404, "System not found");
      const impls = await prisma.controlImplementation.findMany({
        where: { systemId, control: { framework } },
        include: { control: { select: { controlId: true } }, _count: { select: { evidenceLinks: true } } },
      });
      for (const impl of impls) {
        implByControlId.set(impl.control.controlId, {
          status: impl.status,
          scoping: impl.scoping,
          evidenceCount: impl._count.evidenceLinks,
        });
      }
    }

    let totalRequirements = 0;
    let satisfied = 0;
    let automatable = 0;

    const out = controls.map((c) => {
      const impl = implByControlId.get(c.controlId) ?? null;
      // v1 fulfillment heuristic: a requirement is "satisfied" when its control has evidence linked.
      const hasEvidence = (impl?.evidenceCount ?? 0) > 0;
      const reqs = (reqsByControl.get(c.controlId) ?? []).map((r) => {
        totalRequirements++;
        if (r.automatable) automatable++;
        const isSatisfied = hasEvidence;
        if (isSatisfied) satisfied++;
        return {
          key: r.key,
          title: r.title,
          description: r.description,
          evidenceType: r.evidenceType,
          cadence: r.cadence,
          automatable: r.automatable,
          checkKey: r.checkKey,
          satisfied: isSatisfied,
        };
      });
      return {
        controlId: c.controlId,
        family: c.family,
        title: c.title,
        text: c.text,
        baseline: c.baseline,
        implementation: impl,
        requirements: reqs,
        // Informational cross-framework references (family-level, NIST -> others only).
        crosswalk: equivalentControls(framework, c.controlId),
      };
    });

    return {
      framework,
      label: FRAMEWORK_CATALOG_LABEL[framework],
      systemId: systemId ?? null,
      controls: out,
      summary: { controls: controls.length, totalRequirements, satisfied, automatable },
    };
  });
}
