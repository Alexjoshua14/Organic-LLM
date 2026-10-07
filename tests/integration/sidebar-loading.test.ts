import { expect, test } from "bun:test";

type Snapshot = {
  loaderCount: number;
  headingCount: number;
  belowSearch: boolean;
  inScroller: boolean;
  sameNavigation: boolean;
};

test(
  "keeps one thread skeleton below navigation while Clerk and threads load",
  async () => {
    const proc = Bun.spawn(
      [
        "bun",
        "--preload",
        "./tests/jsdom-preload.ts",
        "--preload",
        "./tests/preload.ts",
        "tests/helpers/sidebar-loading-probe.tsx",
      ],
      { cwd: process.cwd(), stdout: "pipe", stderr: "pipe" }
    );
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    if (exitCode !== 0) throw new Error(`Sidebar loading probe failed:\n${stderr}`);

    const result = JSON.parse(stdout.trim().split("\n").at(-1)!) as {
      sessionLoading: Snapshot;
      threadsLoading: Snapshot;
      loaded: Snapshot & { hasThread: boolean };
    };

    for (const state of [result.sessionLoading, result.threadsLoading]) {
      expect(state).toEqual({
        loaderCount: 1,
        headingCount: 1,
        belowSearch: true,
        inScroller: true,
        sameNavigation: true,
      });
    }
    expect(result.loaded.loaderCount).toBe(0);
    expect(result.loaded.headingCount).toBe(1);
    expect(result.loaded.sameNavigation).toBe(true);
    expect(result.loaded.hasThread).toBe(true);
  },
  { timeout: 30_000 }
);
