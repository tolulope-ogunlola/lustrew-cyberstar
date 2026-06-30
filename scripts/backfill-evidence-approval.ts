import { PrismaClient } from "@prisma/client";

// One-time data migration for the Phase B evidence freshness/approval feature.
//
// Run ONCE after `prisma migrate deploy` adds the approval columns:
//   npx tsx scripts/backfill-evidence-approval.ts
//
// Evidence created before this feature has no `collectedAt` (the column was added with no default).
// New evidence always sets `collectedAt`, so a null value uniquely identifies pre-existing rows.
// Those rows were "good" evidence under the old model, so we mark them APPROVED with a collection
// date of their creation — preventing a false spike of EVIDENCE_* alerts and a freshness drop.

const prisma = new PrismaClient();

async function main() {
  const legacy = await prisma.evidence.findMany({
    where: { collectedAt: null },
    select: { id: true, createdAt: true, approvalStatus: true },
  });
  console.log(`Found ${legacy.length} pre-existing evidence row(s) to backfill.`);

  let updated = 0;
  for (const e of legacy) {
    await prisma.evidence.update({
      where: { id: e.id },
      data: {
        approvalStatus: "APPROVED",
        collectedAt: e.createdAt,
        reviewedAt: e.createdAt,
        reviewNote: "Backfilled as approved (pre-dates the approval workflow).",
        statusHistory: {
          create: { status: "APPROVED", note: "Backfilled (migration).", changedBy: null },
        },
      },
    });
    updated++;
  }
  console.log(`Backfill complete: ${updated} evidence row(s) marked APPROVED.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
