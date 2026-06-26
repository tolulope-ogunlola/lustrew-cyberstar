import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Switch the Prisma datasource provider between local dev (sqlite) and production (postgresql).
// The schema is intentionally provider-agnostic (no enums / array columns / Json / @db.Text), so
// only this one line changes.
//   npm run db:provider:sqlite
//   npm run db:provider:postgres

const target = (process.argv[2] || "").toLowerCase();
if (target !== "sqlite" && target !== "postgresql") {
  console.error('Usage: tsx scripts/set-db-provider.ts <sqlite|postgresql>');
  process.exit(1);
}

const schemaPath = join(__dirname, "..", "prisma", "schema.prisma");
const schema = readFileSync(schemaPath, "utf8");

// Only the datasource uses sqlite/postgresql; the generator uses "prisma-client-js".
const updated = schema.replace(/provider = "(sqlite|postgresql)"/, `provider = "${target}"`);
if (updated === schema && !schema.includes(`provider = "${target}"`)) {
  console.error("Could not find the datasource provider line to update.");
  process.exit(1);
}

writeFileSync(schemaPath, updated);
console.log(`Datasource provider set to "${target}".`);
console.log(
  target === "postgresql"
    ? "Next: set DATABASE_URL to your Postgres URL, then `npm run db:migrate:dev -- --name init` (first time) or `npm run db:migrate` (deploy)."
    : "Next: `npm run db:push && npm run db:seed` for local SQLite dev."
);
