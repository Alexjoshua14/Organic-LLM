import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "bun run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      // Make E2E deterministic/cheap: fake LLM + skip slow side effects.
      AION_TEST_MODE: process.env.AION_TEST_MODE ?? "1",
    },
  },
});
