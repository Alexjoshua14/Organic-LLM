import { test, expect } from "@playwright/test";

/**
 * Real-browser coverage of the Mermaid render pipeline (strict securityLevel +
 * SVG sanitization). JSDOM can't run Mermaid's full render, so the harness page
 * at /sandbox/prototypes/mermaid is the source of truth for "does it actually
 * draw and degrade gracefully".
 *
 * /sandbox is Clerk-protected, so this signs in like aion.spec.ts and skips when
 * E2E_CLERK_EMAIL / E2E_CLERK_PASSWORD are not provided.
 */
async function signInIfNeeded(page: import("@playwright/test").Page) {
  const email = process.env.E2E_CLERK_EMAIL;
  const password = process.env.E2E_CLERK_PASSWORD;

  test.skip(!email || !password, "Set E2E_CLERK_EMAIL and E2E_CLERK_PASSWORD to run this test.");

  await page.goto("/");

  const signInButton = page.getByRole("button", { name: /sign in/i }).first();
  if (await signInButton.isVisible().catch(() => false)) {
    await signInButton.click();

    const emailInput = page
      .locator('input[type="email"], input[name="identifier"], input[autocomplete="email"]')
      .first();
    await emailInput.waitFor({ state: "visible", timeout: 30_000 });
    await emailInput.fill(email!);

    const continueBtn = page.getByRole("button", { name: /continue|sign in/i }).first();
    await continueBtn.click();

    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.waitFor({ state: "visible", timeout: 30_000 });
    await passwordInput.fill(password!);

    const submitBtn = page.getByRole("button", { name: /continue|sign in/i }).first();
    await submitBtn.click();
  }

  await expect(page.getByRole("button", { name: /sign in/i })).toHaveCount(0, { timeout: 30_000 });
}

test.describe("Mermaid render harness", () => {
  test.beforeEach(async ({ page }) => {
    await signInIfNeeded(page);
    await page.goto("/sandbox/prototypes/mermaid");
    await expect(page.getByRole("heading", { name: "Mermaid render harness" })).toBeVisible();
  });

  const validCases: { id: string; expectText: string }[] = [
    { id: "flowchart", expectText: "Receive request" },
    { id: "sequence", expectText: "Submit form" },
    { id: "state", expectText: "Running" },
    { id: "subgraph", expectText: "Cognition" },
    { id: "special-labels", expectText: "Cost (USD)" },
  ];

  for (const { id, expectText } of validCases) {
    test(`renders the ${id} diagram to SVG`, async ({ page }) => {
      const section = page.getByTestId(`mermaid-case-${id}`);
      const svg = section.locator("svg");

      await expect(svg).toBeVisible({ timeout: 15_000 });
      await expect(section).toContainText(expectText);
      // The security sanitizer must never let a <script> through.
      await expect(section.locator("script")).toHaveCount(0);
    });
  }

  test("degrades invalid source to a readable error, not a crash", async ({ page }) => {
    const section = page.getByTestId("mermaid-case-invalid");

    await expect(section.getByRole("alert")).toContainText("Diagram could not be rendered", {
      timeout: 15_000,
    });
    await expect(section.locator("svg")).toHaveCount(0);
  });
});
