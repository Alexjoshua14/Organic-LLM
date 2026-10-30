import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";

// Isolated headless geometry checks; no application server, account, or desktop browser.
export default defineConfig({
  testDir: ".",
  testMatch: "composer-resize.spec.ts",
  outputDir: join(tmpdir(), "organic-composer-resize-results"),
  timeout: 15_000,
  workers: 1,
  reporter: "list",
  use: {
    headless: true,
    viewport: { width: 1512, height: 800 },
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
        },
      },
    },
    {
      name: "webkit",
      use: {
        browserName: "webkit",
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH || undefined,
        },
      },
    },
  ],
});
