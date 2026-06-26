import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Integration tests run against a dedicated throwaway DB (provisioned in globalSetup), separate
// from the dev DB and the fast unit suite. Defaults to SQLite; CI can point TEST_DATABASE_URL at
// a Postgres service to validate the production database too.
// `file:` URLs resolve relative to the Prisma schema dir (prisma/), so this lands at
// prisma/test-integration.db (matching .gitignore), not a nested prisma/prisma/ path.
const TEST_DB = process.env.TEST_DATABASE_URL || "file:./test-integration.db";

export default defineConfig({
  test: {
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/integration/setup.ts"],
    env: { DATABASE_URL: TEST_DB },
    fileParallelism: false,
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
