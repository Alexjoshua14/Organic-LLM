import { describe, expect, test } from "bun:test";

/**
 * Guards the article-HTML trust boundary in a runtime without a DOM.
 *
 * tests/jsdom-preload.ts installs a global `window`, which makes the browser
 * DOMPurify build functional in-process and would let both helpers pass even if
 * the server sanitizer stopped working. So the sanitizers run in a spawned bare
 * process instead — the same shape as a server action or an SSR render.
 */
const INPUT =
  '<h2 id="takeaway-0">Intro</h2><p onclick="alert(1)">Hi</p><script>alert("xss")</script>';

type ProbeResult = {
  hasWindow: boolean;
  server: string;
  sink: string;
};

async function runProbe(): Promise<ProbeResult> {
  const proc = Bun.spawn(["bun", "tests/helpers/article-sanitize-probe.ts", INPUT], {
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
    throw new Error(`Article sanitize probe failed (exit ${exitCode}):\n${stderr}`);
  }

  const lastLine = stdout.trim().split("\n").at(-1) ?? "";

  return JSON.parse(lastLine) as ProbeResult;
}

describe("article HTML trust boundary without a DOM", () => {
  test(
    "the server sanitizer strips scripts and handlers in a bare process",
    async () => {
      const probe = await runProbe();

      // If this fails the test is no longer testing what it claims to.
      expect(probe.hasWindow).toBe(false);

      expect(probe.server).not.toContain("<script");
      expect(probe.server).not.toContain("onclick");
      expect(probe.server).toContain('id="takeaway-0"');
      expect(probe.server).toContain("Hi");
    },
    { timeout: 30_000 }
  );

  test(
    "the sink passes through without a DOM, so SSR relies on the server pass",
    async () => {
      const probe = await runProbe();

      expect(probe.hasWindow).toBe(false);

      // This pins the documented contract, not a goal: the generation actions and
      // the Supabase read path sanitize server-side, and the sink only re-checks in
      // the browser. If this ever changes to sanitize or throw here, the SSR notes
      // in RabbitHoleArticle and reSanitizeArticleHtmlInBrowser change with it.
      expect(probe.sink).toBe(INPUT);
    },
    { timeout: 30_000 }
  );
});
