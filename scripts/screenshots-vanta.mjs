// Capture screenshots of the new Compliance Automation (Vanta-parity) pages.
//   npm run dev   # in another terminal (seeded DB)
//   SHOT_OUT=/path/to/out node scripts/screenshots-vanta.mjs
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const OUT = process.env.SHOT_OUT || "docs/screenshots/vanta";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function newCtx() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("cyberstar_welcomed", "1");
      localStorage.setItem("cyberstar_onboarding_dismissed", "1");
      localStorage.setItem("theme", "dark");
      document.documentElement.classList.add("dark");
    } catch {}
  });
  return ctx;
}

// Hide the Next.js dev-mode indicator so shots are clean.
async function hideDevOverlay(page) {
  await page.addStyleTag({ content: `nextjs-portal, [data-nextjs-toast], [data-next-badge-root], #__next-build-watcher { display: none !important; }` }).catch(() => {});
}

async function shot(page, name, { full = false } = {}) {
  // Wait for client data to load (pages render "Loading…" until their useApi fetch resolves).
  await page.waitForFunction(() => !/Loading/.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1600); // settle nested panels (e.g. auditor sub-tables)
  await hideDevOverlay(page);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${name}.jpg`, fullPage: full, type: "jpeg", quality: 72 });
  console.log("captured", name);
}

async function login(page, email) {
  await page.goto(`${BASE}/login`);
  await page.locator("input[type=email]").fill(email);
  await page.locator("input[type=password]").fill("Password123!");
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 }).catch(() => {}),
    page.getByRole("button", { name: "Sign in" }).click(),
  ]);
  await page.waitForTimeout(1200);
  // Dismiss the first-run welcome modal if it appears.
  await page.getByRole("button", { name: "Get started" }).click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(400);
}

try {
  // 1) Public Trust Center (no auth)
  {
    const ctx = await newCtx();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/trust/lustrew`);
    await page.getByRole("heading", { name: "Lustrew Dynamics" }).waitFor({ timeout: 30000 }).catch(() => {});
    await shot(page, "01-trust-public", { full: true });
    await ctx.close();
  }

  // 2) Internal app pages (SME login)
  {
    const ctx = await newCtx();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60_000);
    await login(page, "sme@cyberstar.gov");

    await page.goto(`${BASE}/checks`);
    await page.getByText(/branch protection|MFA enforced|Automated Checks/i).first().waitFor({ timeout: 30000 }).catch(() => {});
    await shot(page, "02-checks-ccm");

    await page.goto(`${BASE}/vendors`);
    await shot(page, "03-vendors");

    await page.goto(`${BASE}/personnel`);
    await shot(page, "04-personnel");

    await page.goto(`${BASE}/questionnaires`);
    await shot(page, "05-questionnaires");

    await page.goto(`${BASE}/trust`);
    await shot(page, "06-trust-admin");

    await page.goto(`${BASE}/admin/auditors`);
    await shot(page, "07-auditors-admin");

    // Evidence approval workflow — Aurora SaaS system, Evidence tab
    await page.goto(`${BASE}/systems`);
    await page.getByText("Aurora SaaS").first().click().catch(() => {});
    await page.waitForURL("**/systems/**").catch(() => {});
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: "Evidence" }).click().catch(() => {});
    await shot(page, "08-evidence-approval");

    await ctx.close();
  }

  // 3) External auditor portal (auditor login)
  {
    const ctx = await newCtx();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60_000);
    await login(page, "auditor@external-firm.example");
    await page.goto(`${BASE}/auditor`);
    await page.getByText("Atlas Cloud Platform").first().waitFor({ timeout: 30000 }).catch(() => {});
    // Wait for at least one control row to load into the Controls table.
    await page.locator("table tbody tr").first().waitFor({ timeout: 20000 }).catch(() => {});
    await shot(page, "09-auditor-portal", { full: true });
    await ctx.close();
  }
} catch (e) {
  console.error("screenshot run error:", e);
} finally {
  await browser.close();
}
