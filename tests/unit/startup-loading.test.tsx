import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { renderToString } from "react-dom/server";

import { StartupLoading } from "@/components/layout/startup-loading";

test("root streams the real loader before a pending session and then delivers the page", async () => {
  // Subprocess keeps framework stubs out of the shared Bun test module registry.
  const child = Bun.spawn(
    [process.execPath, "--no-env-file", "tests/fixtures/startup/stream-root.tsx"],
    { cwd: resolve(import.meta.dir, "../.."), stdout: "pipe", stderr: "pipe" }
  );
  const [output, errors, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect(errors).toBe("");
  expect(code).toBe(0);
  const { initial, rest } = JSON.parse(output);
  expect(initial).toContain("<html");
  expect(initial).toContain("<body");
  expect(initial).toContain("data-startup-loading");
  expect(initial).toContain('role="status"');
  expect(initial).toContain('data-activity-state="working"');
  expect(initial).toContain("organic-agent-dot-grid");
  expect(initial).toContain("liquid-chrome-page-fill");
  expect(initial).toContain("localStorage.getItem");
  expect(initial.indexOf("<script")).toBeLessThan(initial.indexOf("data-startup-loading"));
  expect(initial).not.toContain("data-private-page");
  expect(initial).not.toContain("data-session-resolved");
  expect(rest).toContain("data-session-resolved");
  expect(rest).toContain("data-private-page");
}, 10_000);

test("startup has a named loading status and visible agent artwork without client effects", () => {
  const html = renderToString(<StartupLoading />);
  const container = document.createElement("div");
  container.innerHTML = html;
  const status = container.querySelector('[role="status"]');
  expect(status?.getAttribute("aria-label")).toBe("Loading Organic LLM");
  expect(status?.getAttribute("aria-busy")).toBe("true");
  expect(container.querySelectorAll("svg circle").length).toBeGreaterThan(0);
  expect(container.querySelector("button, input, a")).toBeNull();
  expect(status?.textContent).toContain("Loading Organic");
});
