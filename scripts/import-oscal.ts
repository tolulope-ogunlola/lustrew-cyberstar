import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseOscalCatalog } from "../src/lib/oscal";

// Import a NIST OSCAL catalog into the Control table.
//   npm run db:import-oscal                       # uses the bundled sample
//   npm run db:import-oscal -- ./path/catalog.json
//   npm run db:import-oscal -- https://.../NIST_SP-800-53_rev5_catalog.json
//
// Official Rev 5 catalog:
//   https://github.com/usnistgov/oscal-content/raw/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json

const prisma = new PrismaClient();

async function loadSource(arg: string | undefined): Promise<unknown> {
  if (arg && /^https?:\/\//.test(arg)) {
    const res = await fetch(arg);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    return res.json();
  }
  const path = arg || join(__dirname, "data", "oscal-sample.json");
  return JSON.parse(readFileSync(path, "utf8"));
}

async function main() {
  const arg = process.argv[2];
  console.log(`Loading OSCAL catalog from: ${arg || "bundled sample"}`);
  const rows = parseOscalCatalog(await loadSource(arg));
  console.log(`Parsed ${rows.length} controls. Upserting…`);

  // OSCAL import targets the NIST 800-53 catalog.
  const FRAMEWORK = "NIST_800_53";
  const existing = new Set(
    (await prisma.control.findMany({ where: { framework: FRAMEWORK }, select: { controlId: true } })).map((c) => c.controlId)
  );
  let created = 0;
  let updated = 0;
  for (const r of rows) {
    await prisma.control.upsert({
      where: { framework_controlId: { framework: FRAMEWORK, controlId: r.controlId } },
      create: { controlId: r.controlId, family: r.family, title: r.title, text: r.text, baseline: r.baseline, framework: FRAMEWORK },
      update: { family: r.family, title: r.title, text: r.text },
    });
    if (existing.has(r.controlId)) updated++;
    else created++;
  }
  const total = await prisma.control.count();
  console.log(`Done. Catalog now holds ${total} controls (${created} new, ${updated} updated this run).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
