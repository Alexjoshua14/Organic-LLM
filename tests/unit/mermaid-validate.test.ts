import { describe, expect, test } from "bun:test";

/**
 * Guards the server-side Mermaid syntax check.
 *
 * Mermaid sanitizes node labels while parsing, so `mermaid.parse` needs a
 * working DOMPurify. Under node/bun there is no global `window`, DOMPurify's
 * singleton exposes no `sanitize`, and every labeled diagram used to classify as
 * an environment failure — validation silently failed open and the generator's
 * fix loop never ran.
 *
 * This must run in a bare process: tests/jsdom-preload.ts installs a global
 * `window`, which makes DOMPurify work by itself and would make this pass even
 * if the fix were reverted.
 */
type ProbeResult = {
  hasWindow: boolean;
  labeled: { status: string; error?: string; reason?: string };
  broken: { status: string; error?: string; reason?: string };
};

async function runProbe(): Promise<ProbeResult> {
  const proc = Bun.spawn(["bun", "tests/helpers/mermaid-validate-probe.ts"], {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    throw new Error(`Mermaid validation probe failed (exit ${exitCode}):\n${stderr}`);
  }

  const lastLine = stdout.trim().split("\n").at(-1) ?? "";

  return JSON.parse(lastLine) as ProbeResult;
}

describe("server-side mermaid validation", () => {
  test(
    "syntax-checks real diagrams in a runtime without a global window",
    async () => {
      const probe = await runProbe();

      // If this fails the test is no longer testing what it claims to.
      expect(probe.hasWindow).toBe(false);

      // A quoted label is what routes mermaid through DOMPurify. Before the fix
      // this came back "unverifiable" and every diagram shipped unchecked.
      expect(probe.labeled.status).toBe("valid");

      expect(probe.broken.status).toBe("invalid");
      expect(probe.broken.error).toContain("Parse error");
    },
    { timeout: 30_000 }
  );

  test(
    "reports the offending line so the fix model has a target",
    async () => {
      const probe = await runProbe();

      expect(probe.broken.error).toContain("Offending line 2:");
      expect(probe.broken.error).toContain("A[cost (USD)] --> B");
    },
    { timeout: 30_000 }
  );
});
