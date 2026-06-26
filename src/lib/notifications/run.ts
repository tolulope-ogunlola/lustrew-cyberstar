import { prisma } from "@/lib/db";
import { buildNotifications, type NotifDraft } from "./rules";

export type RunResult = { created: number; updated: number; resolved: number; total: number };

// Recompute the org's continuous-monitoring notifications. Idempotent: existing notifications are
// upserted (preserving read state), and notifications whose underlying condition has cleared are
// deleted. Safe to call on a schedule.
export async function runNotifications(orgId: string): Promise<RunResult> {
  const systems = await prisma.system.findMany({
    where: { orgId },
    select: { id: true, name: true },
  });

  const now = new Date();
  const drafts: NotifDraft[] = [];

  for (const system of systems) {
    const [poams, rmfSteps, vulns, risks, impls] = await Promise.all([
      prisma.poam.findMany({
        where: { systemId: system.id },
        select: { id: true, poamNumber: true, weaknessTitle: true, severity: true, status: true, scheduledCompletion: true },
      }),
      prisma.rmfStep.findMany({ where: { systemId: system.id }, select: { id: true, step: true, status: true, dueDate: true } }),
      prisma.vulnerability.findMany({ where: { systemId: system.id }, select: { id: true, title: true, severity: true, state: true } }),
      prisma.risk.findMany({
        where: { systemId: system.id },
        select: { id: true, riskNumber: true, title: true, status: true, likelihood: true, impact: true, targetDate: true },
      }),
      prisma.controlImplementation.findMany({
        where: { systemId: system.id },
        select: { status: true, scoping: true, _count: { select: { evidenceLinks: true } } },
      }),
    ]);

    const missingEvidenceCount = impls.filter(
      (i) =>
        i.scoping !== "NOT_APPLICABLE" &&
        (i.status === "IMPLEMENTED" || i.status === "PARTIALLY_IMPLEMENTED") &&
        i._count.evidenceLinks === 0
    ).length;

    drafts.push(
      ...buildNotifications({
        systemId: system.id,
        systemName: system.name,
        now,
        poams,
        rmfSteps,
        vulns,
        risks,
        missingEvidenceCount,
      })
    );
  }

  const currentKeys = drafts.map((d) => d.dedupeKey);
  const existing = await prisma.notification.findMany({ where: { orgId }, select: { dedupeKey: true } });
  const existingKeys = new Set(existing.map((e) => e.dedupeKey));

  let created = 0;
  for (const d of drafts) {
    if (!existingKeys.has(d.dedupeKey)) created++;
    await prisma.notification.upsert({
      where: { orgId_dedupeKey: { orgId, dedupeKey: d.dedupeKey } },
      create: {
        orgId,
        dedupeKey: d.dedupeKey,
        category: d.category,
        severity: d.severity,
        title: d.title,
        body: d.body,
        systemId: d.systemId,
        systemName: d.systemName,
        entityType: d.entityType,
        entityId: d.entityId,
      },
      // Refresh display fields on re-run; do not reset isRead.
      update: { category: d.category, severity: d.severity, title: d.title, body: d.body, systemName: d.systemName },
    });
  }

  // Resolve (delete) notifications whose condition no longer holds.
  const resolved =
    currentKeys.length === 0
      ? (await prisma.notification.deleteMany({ where: { orgId } })).count
      : (await prisma.notification.deleteMany({ where: { orgId, dedupeKey: { notIn: currentKeys } } })).count;

  return { created, updated: drafts.length - created, resolved, total: drafts.length };
}
