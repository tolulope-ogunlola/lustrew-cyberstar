// Capture documentation screenshots against a running dev server (http://localhost:3000).
//   npm run dev   # in another terminal (seeded DB)
//   node scripts/screenshots.mjs
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const OUT = "docs/screenshots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
// Suppress first-run overlays so shots are clean.
await ctx.addInitScript(() => {
  try {
    localStorage.setItem("cyberstar_welcomed", "1");
    localStorage.setItem("cyberstar_onboarding_dismissed", "1");
  } catch {}
});
const page = await ctx.newPage();
page.setDefaultTimeout(60_000);
page.setDefaultNavigationTimeout(60_000);

async function setTheme(theme) {
  await page.evaluate((t) => {
    localStorage.setItem("theme", t);
    document.documentElement.classList.toggle("dark", t === "dark");
  }, theme);
}

async function shot(name, { full = false } = {}) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  console.log("captured", name);
}

async function login() {
  await page.goto(`${BASE}/login`);
  await page.locator("input[type=email]").fill("sme@cyberstar.gov");
  await page.locator("input[type=password]").fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");
}

try {
  // Landing — light then dark
  await page.goto(`${BASE}/`);
  await setTheme("light");
  await page.reload();
  await shot("landing-light", { full: true });
  await setTheme("dark");
  await page.reload();
  await shot("landing-dark", { full: true });

  await login();

  await setTheme("dark");
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(800);
  await shot("dashboard-dark");

  await setTheme("light");
  await page.reload();
  await page.waitForTimeout(800);
  await shot("dashboard-light");

  await setTheme("dark");
  // System workspace (Controls tab is default)
  await page.goto(`${BASE}/systems`);
  await page.getByRole("link").filter({ hasText: /Atlas|Helix/ }).first().click().catch(() => {});
  await page.waitForURL("**/systems/**").catch(() => {});
  await page.waitForTimeout(800);
  await shot("system-controls-dark");

  // Risk register heatmap
  await page.getByRole("button", { name: "Risks" }).click().catch(() => {});
  await page.waitForTimeout(600);
  await shot("system-risks-dark");

  // Reports
  await page.goto(`${BASE}/reports`);
  await page.waitForTimeout(600);
  await shot("reports-dark");

  // Help panel open on the dashboard
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole("button", { name: "Info" }).click();
  await page.getByRole("dialog", { name: "Help" }).waitFor();
  await shot("help-panel-dark");
} catch (e) {
  console.error("screenshot run error:", e);
} finally {
  await browser.close();
}
