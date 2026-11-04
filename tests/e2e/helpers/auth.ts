import { expect, test, type Page } from "@playwright/test";

/** Protected routes must exercise the application with a completed Clerk sign-in. */
export async function signIn(page: Page): Promise<void> {
  const email = process.env.E2E_CLERK_EMAIL;
  const password = process.env.E2E_CLERK_PASSWORD;

  test.skip(!email || !password, "Set E2E_CLERK_EMAIL and E2E_CLERK_PASSWORD to run this test.");

  await page.goto("/");
  // Each test starts with a fresh context. Wait for hydration instead of treating
  // a temporarily absent sign-in button as an authenticated session.
  await page
    .getByRole("button", { name: /^sign in$/i })
    .first()
    .click();
  await page.locator('input[type="email"], input[name="identifier"]').first().fill(email!);
  await page.getByRole("button", { name: /^continue$/i }).click();
  await page.locator('input[type="password"]').fill(password!);
  await page
    .getByRole("button", { name: /^continue$|^sign in$/i })
    .last()
    .click();

  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const clerk = (window as Window & { Clerk?: { user?: { id: string } | null } }).Clerk;
          return Boolean(clerk?.user?.id);
        }),
      { timeout: 30_000 }
    )
    .toBe(true);
}
