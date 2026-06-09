import { test, expect } from "@playwright/test";

test.describe("Welcome hero (signed out)", () => {
  test("shows welcome copy and auth CTAs without composer", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("remembers");
    await expect(page.getByRole("button", { name: "Create account" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" }).first()).toBeVisible();
    await expect(page.getByText("Explore first")).toBeVisible();

    await expect(page.getByPlaceholder("What do you want to explore?")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Let's Chat" })).toHaveCount(0);
  });

  test("hero section has no privacy link; page footer has Coalescence Labs and privacy", async ({
    page,
  }) => {
    await page.goto("/");

    const heroSection = page.locator("section").first();
    await expect(heroSection.getByRole("link", { name: /Privacy & security/i })).toHaveCount(0);
    await expect(heroSection.getByText(welcomeTrustSnippet())).toHaveCount(0);

    const pageFooter = page.locator("footer").last();
    await expect(pageFooter.getByText("Coalescence Labs")).toBeVisible();
    await expect(pageFooter.getByRole("link", { name: /Privacy & security/i })).toBeVisible();
  });

  test("explore aside links to public routes", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: /Anatomy of a response/i }).first()).toHaveAttribute(
      "href",
      "/showcase/anatomy"
    );
    await expect(page.getByRole("link", { name: /^Blog/i }).first()).toHaveAttribute("href", "/blog");
    await expect(page.getByRole("link", { name: /Memory lens/i })).toHaveCount(0);
  });

  test("features and highlights sections appear below the fold", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "What you can work in" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Chat", exact: true })).toBeVisible();
    await expect(page.getByText("Arcadia")).toBeVisible();
    await expect(page.getByText("Noesis")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Rabbit holes" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Strata" })).toBeVisible();

    await expect(page.getByRole("heading", { name: "Built for work that lasts" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Encrypted at rest" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pick up where you left off" })).toBeVisible();
    await page.getByRole("heading", { name: "Pick up where you left off" }).scrollIntoViewIfNeeded();
    await expect(page.locator('[data-illustration-id="streaming"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your model, your turn" })).toBeVisible();
    await page.getByRole("heading", { name: "Your model, your turn" }).scrollIntoViewIfNeeded();
    await expect(page.locator('[data-illustration-id="models"]')).toBeVisible();
  });
});

function welcomeTrustSnippet() {
  return "Message content and summaries are encrypted at rest (AES-256-GCM)";
}
