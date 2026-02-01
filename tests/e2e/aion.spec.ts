import { test, expect } from "@playwright/test";

async function signInIfNeeded(page: import("@playwright/test").Page) {
  const email = process.env.E2E_CLERK_EMAIL;
  const password = process.env.E2E_CLERK_PASSWORD;

  test.skip(
    !email || !password,
    "Set E2E_CLERK_EMAIL and E2E_CLERK_PASSWORD to run this test.",
  );

  await page.goto("/");

  // If already signed in, we'll see no obvious sign-in CTA.
  const signInButton = page.getByRole("button", { name: /sign in/i }).first();
  if (await signInButton.isVisible().catch(() => false)) {
    await signInButton.click();

    // Clerk can render in a modal or redirect. Try common selectors.
    const emailInput = page
      .locator(
        'input[type="email"], input[name="identifier"], input[autocomplete="email"]',
      )
      .first();
    await emailInput.waitFor({ state: "visible", timeout: 30_000 });
    await emailInput.fill(email);

    const continueBtn = page
      .getByRole("button", { name: /continue|sign in/i })
      .first();
    await continueBtn.click();

    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.waitFor({ state: "visible", timeout: 30_000 });
    await passwordInput.fill(password);

    const submitBtn = page
      .getByRole("button", { name: /continue|sign in/i })
      .first();
    await submitBtn.click();
  }

  // Heuristic: ensure sidebar isn't showing Sign In anymore.
  await expect(page.getByRole("button", { name: /sign in/i })).toHaveCount(0, {
    timeout: 30_000,
  });
}

test.describe("Aion API (E2E)", () => {
  test("POST /api/ai/aion returns 200 (authenticated)", async ({ page }) => {
    await signInIfNeeded(page);

    const result = await page.evaluate(async () => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? // @ts-ignore
            crypto.randomUUID()
          : "7b52de83-bf70-4b7b-8d9b-4a306b8b8d87";

      const res = await fetch("/api/ai/aion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id,
          memory: false,
          message: {
            id: "e2e-user-msg-1",
            role: "user",
            parts: [{ type: "text", text: "E2E ping" }],
          },
        }),
      });

      const text = await res.text();
      return { status: res.status, text };
    });

    expect(result.status).toBe(200);
    // In AION_TEST_MODE, route uses a deterministic fake LLM output.
    expect(result.text).toContain("E2E_FAKE_LLM");
  });
});

