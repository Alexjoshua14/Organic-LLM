import { expect, test } from "bun:test";

test("developer feedback requires explicit admin authorization", () => {
  const result = Bun.spawnSync([process.execPath, "run", "tests/fixtures/require-admin-check.ts"], {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
});
