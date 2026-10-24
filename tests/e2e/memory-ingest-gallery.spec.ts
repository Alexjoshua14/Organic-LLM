import { test, expect } from "@playwright/test";

import { signIn } from "./helpers/auth";

test("prototype gallery lists memory ingest entry", async ({ page }) => {
  await signIn(page);
  await page.goto("/sandbox/prototypes");
  await expect(page.getByRole("link", { name: /memory ingest/i })).toBeVisible();
});
