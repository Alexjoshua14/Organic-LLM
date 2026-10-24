import { expect, test } from "bun:test";

test.each([
  ["search, sorting, deletion, and voting", "./tests/fixtures/memory-lens.test.tsx"],
  ["server rate limits and identity", "./tests/fixtures/memory-rate-limits.test.ts"],
])(
  "memory lens %s regressions",
  (_name, fixture) => {
    // Bun module mocks are process-global. Isolate the real page from other suites' server mocks.
    const result = Bun.spawnSync(
      [
        process.execPath,
        "test",
        "--preload",
        "./tests/jsdom-preload.ts",
        "--preload",
        "./tests/preload.ts",
        fixture!,
      ],
      { cwd: process.cwd(), stdout: "pipe", stderr: "pipe" }
    );

    expect(result.exitCode, result.stdout.toString() + result.stderr.toString()).toBe(0);
  },
  30000
);
