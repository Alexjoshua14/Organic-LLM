import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Isolated component regression: no dev server, account, application data, or live LLM calls.
export default defineConfig({
  testDir: ".",
  testMatch: "conversation-scroll.spec.ts",
  outputDir: join(tmpdir(), "organic-conversation-scroll-results"),
  timeout: 15_000,
  workers: 1,
  reporter: "list",
  use: {
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
    {
      name: "reduced-motion",
      use: { viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" },
    },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "short-viewport", use: { viewport: { width: 844, height: 390 } } },
  ],
});
