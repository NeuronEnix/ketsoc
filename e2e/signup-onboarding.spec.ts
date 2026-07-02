import { test, expect } from "@playwright/test";

test("landing → signup → onboarding → overview golden path", async ({
  page,
}) => {
  // Local D1 persists across runs, so the email must be unique per run.
  const email = `e2e-${Date.now()}@ketsoc.dev`;

  // Landing page
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Sockets at the edge/ })
  ).toBeVisible();
  await page
    .getByRole("link", { name: /start building/i })
    .first()
    .click();
  await page.waitForURL("**/signup");

  // Sign up
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("ketsoc-e2e");
  await page.getByRole("button", { name: "Create account" }).click();

  // Onboarding: the org is auto-created ("Personal") — keys appear directly
  await expect(page.getByText(/kpk\./).first()).toBeVisible();
  await expect(page.getByText(/ksk\./).first()).toBeVisible();

  // Continue → Overview
  await page.getByRole("button", { name: "Continue to dashboard" }).click();
  await page.waitForURL("**/overview");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  // Sidebar nav is present
  await expect(page.getByRole("link", { name: "Connections" })).toBeVisible();

  // Env switcher shows the seeded prod environment, in live mode
  await expect(page.getByRole("button", { name: "prod" })).toBeVisible();
  await expect(page.getByText("prod · live")).toBeVisible();

  // At least one metric readout resolves to a real (seeded) value, not "—"
  await expect(page.locator("span.font-mono.text-3xl").first()).toHaveText(
    /^[\d,.]+$/,
    { timeout: 10_000 }
  );

  // The cookie session survives a full reload
  await page.reload();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  expect(page.url()).toContain("/overview");
});
