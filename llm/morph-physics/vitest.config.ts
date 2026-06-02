import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node-unit",
          environment: "node",
          setupFiles: ["src/test/setup.ts"],
          include: ["src/**/*.test.ts"],
          exclude: [
            "**/*.dom.test.ts",
            "**/*.integration.test.ts",
          ],
        },
      },
      {
        test: {
          name: "jsdom",
          environment: "jsdom",
          setupFiles: ["src/test/setup.ts"],
          include: [
            "**/*.dom.test.ts",
            "**/*.integration.test.ts",
            "**/*.test.tsx",
          ],
        },
      },
    ],
  },
});
