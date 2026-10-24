/**
 * Ergon showcase — zero-cost public replay.
 * Signed-out: reduced-motion final state + network guard (no POSTs; /api only voice status GET).
 */
import { expect, test } from "@playwright/test";

test.describe("Ergon showcase (signed out)", () => {
  test.use({
    reducedMotion: "reduce",
  });

  test("renders final board and next-up view under reduced motion", async ({ page }) => {
    await page.goto("/showcase/ergon", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Ergon live board" })).toBeVisible();
    await expect(page.getByText("Beta launch week").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Full board").first()).toBeVisible();
    await expect(page.getByText("Next up").first()).toBeVisible();
    await expect(page.getByText("Send waitlist invite email").first()).toBeVisible();
    await expect(page.getByText("Assemble press kit").first()).toBeVisible();
  });
});

test.describe("Ergon showcase network guard", () => {
  test("autoplay makes no POSTs and no /api except voice status GET", async ({ page }) => {
    const apiGets: string[] = [];
    const posts: string[] = [];

    page.on("request", (request) => {
      const url = request.url();
      const method = request.method();
      let path: string;

      try {
        path = new URL(url).pathname;
      } catch {
        return;
      }

      if (method === "POST") {
        posts.push(path);
      }
      if (path.startsWith("/api/")) {
        if (method === "GET") apiGets.push(path);
        else posts.push(`${method} ${path}`);
      }
    });

    await page.goto("/showcase/ergon", { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);

    expect(posts).toEqual([]);
    for (const path of apiGets) {
      expect(path).toBe("/api/ai/speak/realtime/active");
    }
  });
});
