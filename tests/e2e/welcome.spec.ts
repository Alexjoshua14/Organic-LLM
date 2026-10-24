import { test, expect } from "@playwright/test";

test.describe("Welcome hero (signed out)", () => {
  // These assertions cover copy and layout; freeze cycling illustration content.
  test.use({ reducedMotion: "reduce" });

  test("shows welcome copy and auth CTAs without composer", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: /An AI workspace that/i })
    ).toContainText("remembers");
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

    const heroSection = page
      .getByRole("heading", { level: 1, name: /An AI workspace that/i })
      .locator("xpath=ancestor::section[1]");
    await expect(heroSection.getByRole("link", { name: /Privacy & security/i })).toHaveCount(0);
    await expect(heroSection.getByText(welcomeTrustSnippet())).toHaveCount(0);

    const pageFooter = page.locator("footer").last();
    await expect(pageFooter.getByText("Coalescence Labs", { exact: true })).toBeVisible();
    await expect(pageFooter.getByRole("link", { name: /Privacy & security/i })).toBeVisible();
  });

  test("explore aside links to public routes", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("link", { name: /Anatomy of a response/i }).first()
    ).toHaveAttribute("href", "/showcase/anatomy");
    await expect(page.getByRole("link", { name: /^Blog/i }).first()).toHaveAttribute(
      "href",
      "/blog"
    );
    await expect(
      page.getByRole("complementary").getByRole("link", { name: /^Showcase/i })
    ).toHaveAttribute("href", "/showcase");
  });

  test("features and highlights sections appear below the fold", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "What you can work in" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Chat", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Main chat", exact: true })).toBeVisible();
    await expect(page.locator('[data-illustration-id="feature-chat"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: "Arcadia", exact: true })).toBeVisible();
    await expect(page.locator('[data-illustration-id="feature-arcadia"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: "Noesis", exact: true })).toBeVisible();
    await page.getByRole("heading", { name: "Noesis", exact: true }).scrollIntoViewIfNeeded();
    await expect(
      page.getByText("Starter prompts and suggested replies generated from past interactions")
    ).toBeVisible();
    await expect(page.getByText("Built to surface what you want to discuss.")).toBeVisible();
    await expect(page.locator('[data-illustration-id="feature-noesis"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: "Rabbit holes" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Strata" })).toBeVisible();
    await page.getByRole("heading", { name: "Strata" }).scrollIntoViewIfNeeded();
    await expect(page.locator('[data-illustration-id="feature-strata"]')).toBeVisible();

    await expect(page.getByRole("heading", { name: "Built for work that lasts" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Encrypted at rest" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pick up where you left off" })).toBeVisible();
    await page
      .getByRole("heading", { name: "Pick up where you left off" })
      .scrollIntoViewIfNeeded();
    await expect(page.locator('[data-illustration-id="streaming"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your model, your turn" })).toBeVisible();
    await page.getByRole("heading", { name: "Your model, your turn" }).scrollIntoViewIfNeeded();
    await expect(page.locator('[data-illustration-id="models"]')).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Structured answers you can scan" })
    ).toBeVisible();
    await page
      .getByRole("heading", { name: "Structured answers you can scan" })
      .scrollIntoViewIfNeeded();
    await expect(page.locator('[data-illustration-id="gen-ui"]')).toBeVisible();
    await expect(
      page
        .locator('[data-illustration-id="gen-ui"]')
        .getByRole("paragraph")
        .filter({ hasText: "Memory shows up per thread, not as a separate sidebar" })
    ).toBeVisible();
  });
});

function welcomeTrustSnippet() {
  return "Message content and summaries are encrypted at rest (AES-256-GCM)";
}
