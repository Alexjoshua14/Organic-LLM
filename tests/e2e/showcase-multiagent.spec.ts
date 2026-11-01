import { expect, test } from "@playwright/test";

const ROUTE = "/showcase/multiagent";

test("heartbeat explains early exits, quiet evaluations and notable changes without agent calls", async ({
  page,
}) => {
  const agentRequests: string[] = [];

  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;

    // The shared app shell may check for an existing voice session; it starts no agent work.
    if (request.method() === "GET" && path === "/api/ai/speak/realtime/active") return;
    if (/\/api\/(chat|ai|subagents)/.test(path)) {
      agentRequests.push(request.url());
    }
  });
  await page.goto(ROUTE);
  await page.getByRole("button", { name: "Nothing changed", exact: true }).click();
  await expect(page.getByText("Same digest. No model call.", { exact: true })).toBeVisible();
  await expect(page.getByText("skipped · no model call", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Small update", exact: true }).click();
  await expect(
    page.getByText("Changed does not always mean useful.", { exact: true })
  ).toBeVisible();
  await expect(page.locator(".ma-status")).toHaveText("quiet");
  await page.getByRole("button", { name: "Decision needed", exact: true }).click();
  await expect(page.locator(".ma-status")).toHaveText("notable");
  await expect(page.getByText("notice + queued reply", { exact: true })).toBeVisible();
  expect(agentRequests).toEqual([]);
});

test("context selection keeps unselected material out of the example assignment", async ({
  page,
}) => {
  await page.goto(ROUTE);
  const workbench = page.locator(".ma-workbench");

  await expect(workbench.locator(".ma-attached details")).toHaveCount(3);
  await workbench.getByRole("checkbox", { name: /Repository context/ }).check();
  await expect(workbench.locator(".ma-attached details")).toHaveCount(4);
  await workbench.getByRole("radio", { name: "Continue thread" }).check();
  await expect(workbench.locator(".ma-manifest")).toContainText("continue");
  for (const checkbox of await workbench.getByRole("checkbox").all()) {
    await checkbox.uncheck();
  }
  await expect(workbench.locator(".ma-attached details")).toHaveCount(0);
  await expect(workbench.locator(".ma-empty")).toContainText("Only the brief is attached");
  await expect(workbench.locator(".ma-manifest")).toContainText("0 attached characters");
});

test("specialist profiles explain their actual tool boundaries", async ({ page }) => {
  await page.goto(ROUTE);
  const roster = page.getByRole("group", { name: "Explore a specialist" });
  const detail = page.locator(".ma-specialist-detail");

  await roster.getByRole("button", { name: /Lyra/ }).click();
  await expect(detail).toContainText("Firecrawl");
  await expect(detail).toContainText("Docling");
  await roster.getByRole("button", { name: /Reed/ }).click();
  await expect(detail).toContainText("not a general GitHub write tool");
  await roster.getByRole("button", { name: /Cass/ }).click();
  await expect(detail).toContainText("Roster role");
  await expect(detail.getByRole("link")).toHaveAttribute(
    "href",
    /github\.com\/Alexjoshua14\/Organic-LLM\/blob\/[a-f0-9]{40}\//
  );
});

test("three equal-size marks cycle, support inspection, and stop moving on pause", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto(ROUTE);
  const study = page.locator(".ma-material-study");

  await study.scrollIntoViewIfNeeded();
  await expect(study.locator(".ma-live-mark")).toHaveCount(3);
  const sizes = await study.locator(".ma-live-mark").evaluateAll((marks) =>
    marks.map((mark) => {
      const box = mark.getBoundingClientRect();

      return { width: box.width, height: box.height };
    })
  );

  expect(sizes[0]).toEqual(sizes[1]);
  expect(sizes[1]).toEqual(sizes[2]);
  await page.clock.runFor(4500);
  await expect(study.locator(".ma-agent-0 .ma-live-mark")).toHaveAttribute(
    "data-activity-state",
    "waiting"
  );
  await expect(study.locator(".ma-agent-1 .ma-live-mark")).toHaveAttribute(
    "data-activity-state",
    "working"
  );
  await study.getByRole("button", { name: "Pause motion", exact: true }).click();
  await expect(study.locator(".ma-live-mark img")).toHaveCount(3);
  await page.clock.runFor(8000);
  await expect(study.locator(".ma-agent-0 .ma-live-mark")).toHaveAttribute(
    "data-activity-state",
    "waiting"
  );
  await study.getByRole("button", { name: "blocked", exact: true }).click();
  await expect(study.locator('.ma-live-mark[data-activity-state="blocked"]')).toHaveCount(3);
});

test("reduced motion disables automatic cycling while keeping manual states usable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  await page.goto(ROUTE);
  const study = page.locator(".ma-material-study");

  await study.scrollIntoViewIfNeeded();
  await expect(study.getByText("Reduced motion respected")).toBeVisible();
  await expect(study.getByRole("button", { name: "Pause motion" })).toBeDisabled();
  await page.clock.runFor(15000);
  await expect(study.locator(".ma-agent-0 .ma-live-mark")).toHaveAttribute(
    "data-activity-state",
    "working"
  );
  await study.getByRole("button", { name: "complete", exact: true }).click();
  await expect(study.locator('.ma-live-mark[data-activity-state="complete"]')).toHaveCount(3);
});

for (const width of [320, 768, 1440]) {
  test(`chapters and interactive panels fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(ROUTE);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.locator(".ma-page").evaluate((root) =>
      [...root.querySelectorAll("*")]
        .filter((element) => {
          if (element.closest(".ma-chapter-nav")) return false;
          const rect = element.getBoundingClientRect();

          return rect.right > window.innerWidth + 1 || rect.left < -1;
        })
        .map((element) => element.className)
    );

    expect(overflow).toEqual([]);
    for (const id of ["heartbeat", "threads", "context", "specialists", "presence"]) {
      await page.locator(`#${id}`).scrollIntoViewIfNeeded();
      await expect(page.locator(`#${id} h2`)).toBeVisible();
    }
  });
}
