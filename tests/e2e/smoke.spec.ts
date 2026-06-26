import { test, expect, type Page } from "@playwright/test";

// Critical-journey smoke tests. Assumes the demo seed (sme@cyberstar.gov / Password123!).

// Suppress the first-run welcome/onboarding overlays so they don't intercept clicks.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("cyberstar_welcomed", "1");
      localStorage.setItem("cyberstar_onboarding_dismissed", "1");
    } catch {}
  });
});

async function login(page: Page, email = "sme@cyberstar.gov") {
  await page.goto("/login");
  await page.locator("input[type=email]").fill(email);
  await page.locator("input[type=password]").fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");
}

test("landing page is public and explains the product", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /regulated cybersecurity compliance/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();
});

test("user can sign in and reach the dashboard", async ({ page }) => {
  await login(page);
  await expect(page.getByText(/Continuous monitoring snapshot/i)).toBeVisible();
});

test("the Info help panel opens with page-specific content", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Info" }).click();
  await expect(page.getByRole("dialog", { name: "Help" })).toBeVisible();
});

test("theme toggle switches between light and dark", async ({ page }) => {
  await login(page);
  const html = page.locator("html");
  const before = (await html.getAttribute("class")) ?? "";
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(html).not.toHaveClass(before);
});

test("RBAC: an executive cannot reach the admin users API", async ({ page }) => {
  await login(page, "exec@cyberstar.gov");
  const res = await page.request.get("/api/admin/users");
  expect(res.status()).toBe(403);
});
