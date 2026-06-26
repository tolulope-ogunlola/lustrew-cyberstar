import { prisma } from "@/lib/db";
import { requireUser, route } from "@/lib/api";

// Drives the dashboard "Getting started" checklist — each step is derived from real org data, so
// items tick off automatically as the user makes progress (no per-user flags to maintain).
export async function GET() {
  return route(async () => {
    const user = await requireUser();
    const org = { system: { orgId: user.orgId } };

    const [systems, implemented, evidence, vulns, stig, poams] = await Promise.all([
      prisma.system.count({ where: { orgId: user.orgId } }),
      prisma.controlImplementation.count({ where: { ...org, status: { not: "NOT_IMPLEMENTED" } } }),
      prisma.evidence.count({ where: org }),
      prisma.vulnerability.count({ where: org }),
      prisma.stigFinding.count({ where: org }),
      prisma.poam.count({ where: org }),
    ]);

    return {
      hasSystem: systems > 0,
      hasImplementedControl: implemented > 0,
      hasEvidence: evidence > 0,
      hasScan: vulns + stig > 0,
      hasPoam: poams > 0,
    };
  });
}
