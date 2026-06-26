// Record the core flow (login → import scan → convert finding to POA&M → dashboard) as an
// animated GIF for the README. Requires a running dev server (npm run dev) with the demo seed.
//   node scripts/demo-gif.mjs
import { chromium } from "@playwright/test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

// gifenc and pngjs are CommonJS — load via require for reliable interop.
const require = createRequire(import.meta.url);
const { GIFEncoder, quantize, applyPalette } = require("gifenc");
const { PNG } = require("pngjs");

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const OUT = "docs";
mkdirSync(OUT, { recursive: true });

// A scan with a unique host so each run yields a fresh OPEN finding to convert.
const host = `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
// Write into a private, per-run temp directory (0700) rather than a predictable shared path.
const csvPath = join(mkdtempSync(join(tmpdir(), "cyberstar-demo-")), "scan.csv");
writeFileSync(
  csvPath,
  [
    "Plugin ID,CVE,Risk,Name,Host,CVSS,Solution",
    `19506,CVE-2024-1337,Critical,"Apache HTTP Server RCE (outdated)",${host},9.8,Upgrade Apache`,
    `42873,,Medium,Weak TLS ciphers enabled,${host},5.3,Disable weak ciphers`,
    `11219,CVE-2024-2025,High,Default admin credentials,${host},8.1,Rotate credentials`,
  ].join("\n")
);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1000, height: 620 } });
await ctx.addInitScript(() => {
  try {
    localStorage.setItem("cyberstar_welcomed", "1");
    localStorage.setItem("cyberstar_onboarding_dismissed", "1");
    localStorage.setItem("theme", "dark");
    document.documentElement.classList.add("dark");
  } catch {}
});
const page = await ctx.newPage();
page.setDefaultTimeout(60_000);
page.setDefaultNavigationTimeout(60_000);

const frames = [];
async function frame(delay) {
  frames.push({ buf: await page.screenshot(), delay });
}

try {
  // 1) Login
  await page.goto(`${BASE}/login`);
  await page.locator("input[type=email]").fill("sme@cyberstar.gov");
  await page.locator("input[type=password]").fill("Password123!");
  await page.waitForTimeout(300);
  await frame(1600);

  // 2) Dashboard
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");
  await page.waitForTimeout(900);
  await frame(1700);

  // 3) Vulnerabilities — before import
  await page.goto(`${BASE}/vulnerabilities`);
  await page.waitForTimeout(900);
  await frame(1500);

  // 4) Import a scan
  await page.locator("input[type=file]").setInputFiles(csvPath);
  await page.getByText(/Imported \d+ findings/).waitFor();
  await page.waitForTimeout(600);
  await frame(1900);

  // 5) Convert a finding to a POA&M
  await page.getByRole("button", { name: "→ POA&M" }).first().click();
  await page.getByText(/Created POAM/).waitFor();
  await page.waitForTimeout(500);
  await frame(1900);

  // 6) POA&M manager — the new item
  await page.goto(`${BASE}/poams`);
  await page.waitForTimeout(900);
  await frame(1700);

  // 7) Dashboard — updated posture
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1000);
  await frame(2600);
} catch (e) {
  console.error("flow error:", e);
}
await browser.close();

// Encode frames → animated GIF (loops forever).
const gif = GIFEncoder();
frames.forEach(({ buf, delay }, i) => {
  const { width, height, data } = PNG.sync.read(buf);
  const rgba = new Uint8Array(data.buffer, data.byteOffset, data.length);
  const palette = quantize(rgba, 256);
  const index = applyPalette(rgba, palette);
  gif.writeFrame(index, width, height, { palette, delay, repeat: i === 0 ? 0 : undefined });
});
gif.finish();
writeFileSync(join(OUT, "demo.gif"), Buffer.from(gif.bytes()));
console.log(`Wrote ${OUT}/demo.gif from ${frames.length} frames`);
