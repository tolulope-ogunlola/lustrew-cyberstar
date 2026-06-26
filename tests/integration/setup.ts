import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";

const TEST_DB = process.env.TEST_DATABASE_URL || "file:./test-integration.db";

// Provision a clean schema on the throwaway integration DB before the suite runs.
export default function setup() {
  // For the local SQLite default, start from a fresh file.
  if (!process.env.TEST_DATABASE_URL) {
    try {
      rmSync(join(process.cwd(), "prisma", "test-integration.db"), { force: true });
    } catch {
      // ignore
    }
  }
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: TEST_DB },
  });
}
