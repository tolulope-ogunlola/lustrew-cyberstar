import { defineConfig, devices } from "@playwright/test";

// E2E smoke tests for critical user journeys. Locally reuses your running dev server; in CI it
// starts one. Seed the DB first (npm run db:push && npm run db:seed).
export default defineConfig({
  testDir: "./tests/e2e",
  // Serialize: a cold Next dev server compiles each route on first hit, so parallel workers thrash.
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    navigationTimeout: 45_000,
    actionTimeout: 15_000,
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
