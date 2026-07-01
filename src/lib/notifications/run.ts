import { prisma } from "@/lib/db";
import { buildNotifications, buildVendorNotifications, buildPersonnelNotifications, buildCheckNotifications, type NotifDraft } from "./rules";
import { isStale, expireStaleEvidence } from "@/lib/evidence";
import { runChecks } from "@/lib/checks/run";

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

  // Flip any approved-but-stale evidence to EXPIRED first so the freshness rules below see it.
  await expireStaleEvidence(orgId, now);

  // Run due CCM checks so the latest results feed the CHECK_FAILED rule below.
  await runChecks(orgId, { due: true });

  for (const system of systems) {
    const [poams, rmfSteps, vulns, risks, impls, evidenceRows] = await Promise.all([
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
      prisma.evidence.findMany({
        where: { systemId: system.id },
        select: { id: true, title: true, approvalStatus: true, validUntil: true, cadenceDays: true, collectedAt: true },
      }),
    ]);

    const evidence = evidenceRows.map((e) => ({
      id: e.id,
      title: e.title,
      approvalStatus: e.approvalStatus,
      validUntil: e.validUntil,
      stale: isStale(e, now),
    }));

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
        evidence,
      })
    );
  }

  // Org-scoped vendor + personnel reminders (not tied to a single system).
  const [vendors, expiringDocsRaw, trainings, accessReviews, onboardingTasks] = await Promise.all([
    prisma.vendor.findMany({
      where: { orgId },
      select: { id: true, vendorNumber: true, name: true, status: true, nextReviewDate: true, hasDpa: true, dpaExpiresAt: true },
    }),
    prisma.vendorDocument.findMany({
      where: { vendor: { orgId }, validUntil: { not: null } },
      select: { id: true, title: true, validUntil: true, vendor: { select: { name: true } } },
    }),
    prisma.trainingAssignment.findMany({
      where: { personnel: { orgId } },
      select: { id: true, status: true, dueDate: true, personnel: { select: { fullName: true } }, course: { select: { name: true } } },
    }),
    prisma.accessReview.findMany({
      where: { personnel: { orgId } },
      select: { id: true, status: true, dueDate: true, personnel: { select: { fullName: true } } },
    }),
    prisma.onboardingTask.findMany({
      where: { personnel: { orgId } },
      select: { id: true, title: true, done: true, dueDate: true, personnel: { select: { fullName: true } } },
    }),
  ]);

  // CCM check failures (latest result per assignment).
  const checkAssignments = await prisma.checkAssignment.findMany({
    where: { orgId, enabled: true },
    include: {
      check: { select: { title: true, severity: true } },
      system: { select: { name: true } },
      results: { orderBy: { checkedAt: "desc" }, take: 1 },
    },
  });
  const failingChecks = checkAssignments
    .filter((a) => a.results[0] && a.results[0].status !== "PASS")
    .map((a) => ({
      assignmentId: a.id,
      systemId: a.systemId,
      systemName: a.system.name,
      checkTitle: a.check.title,
      severity: a.check.severity,
      details: a.results[0].details,
      status: a.results[0].status,
    }));

  drafts.push(...buildCheckNotifications({ failing: failingChecks }));

  drafts.push(
    ...buildVendorNotifications({
      now,
      vendors,
      expiringDocs: expiringDocsRaw.map((d) => ({ id: d.id, vendorName: d.vendor.name, title: d.title, validUntil: d.validUntil })),
    }),
    ...buildPersonnelNotifications({
      now,
      trainings: trainings.map((t) => ({ id: t.id, personName: t.personnel.fullName, courseName: t.course.name, status: t.status, dueDate: t.dueDate })),
      accessReviews: accessReviews.map((r) => ({ id: r.id, personName: r.personnel.fullName, status: r.status, dueDate: r.dueDate })),
      onboardingTasks: onboardingTasks.map((t) => ({ id: t.id, personName: t.personnel.fullName, title: t.title, done: t.done, dueDate: t.dueDate })),
    })
  );

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
