import { test, expect } from "@playwright/test";

test("prototype gallery lists memory ingest entry", async ({ page }) => {
  await page.goto("/sandbox/prototypes");
  await expect(page.getByRole("link", { name: /memory ingest/i })).toBeVisible();
});
