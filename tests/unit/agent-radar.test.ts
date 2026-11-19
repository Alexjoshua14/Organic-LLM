import { describe, expect, test } from "bun:test";

import {
  claimIsLive,
  diffSnapshots,
  encodeProjectDir,
  formatAge,
  lineage,
  parsePortRanges,
  parsePs,
  parseSs,
  parseWorktrees,
  pathsOverlap,
  placeOf,
  topLevelAgents,
  type Claim,
} from "../../scripts/agent-radar";

const PS = `
    1     0  90000 systemd
 1188     1  80000 node-MainThread
 2001  1188   8300 claude
 2002  2001   8300 sh
 3001  1188   2300 codex
 3002  3001   1900 codex-code-mode
 4001  1188   1000 claude
 4002  4001   1000 sh
 4003  4002     12 bun
`;

describe("processes", () => {
  const procs = parsePs(PS);

  test("parsePs reads pid, parent, age and command", () => {
    expect(procs).toHaveLength(9);
    expect(procs.find((p) => p.pid === 3001)).toEqual({ pid: 3001, ppid: 1188, age: 2300, comm: "codex" });
  });

  test("topLevelAgents keeps one entry per agent and drops helpers and shells", () => {
    expect(topLevelAgents(procs).map((p) => p.pid)).toEqual([2001, 3001, 4001]);
  });

  test("a child of an agent that is the same kind is not a second agent", () => {
    const nested = parsePs("10 1 100 claude\n11 10 100 claude");
    expect(topLevelAgents(nested).map((p) => p.pid)).toEqual([10]);
  });

  test("lineage walks from a process up through its ancestors", () => {
    expect(lineage(4003, procs).map((p) => p.comm)).toEqual(["bun", "sh", "claude", "node-MainThread", "systemd"]);
  });
});

describe("places", () => {
  const trees = parseWorktrees(
    [
      "worktree /home/a/Repo",
      "HEAD abc",
      "branch refs/heads/feat/x",
      "",
      "worktree /home/a/.t3/worktrees/Repo/t3-7ba2a879-a5c03526639f6fb5",
      "HEAD def",
      "branch refs/heads/t3/blog",
      "",
      "worktree /home/a/.t3/worktrees/Repo/old",
      "HEAD 123",
      "detached",
    ].join("\n")
  );

  test("parseWorktrees marks the first as main and names detached heads", () => {
    expect(trees.map((t) => [t.main, t.branch])).toEqual([
      [true, "feat/x"],
      [false, "t3/blog"],
      [false, "(detached)"],
    ]);
  });

  test("placeOf labels the worktree, shortens t3 hashes, and notes what is outside the repo", () => {
    expect(placeOf("/home/a/Repo/components", trees, "/home/a")).toEqual({ place: "main (feat/x)", inRepo: true });
    expect(placeOf("/home/a/.t3/worktrees/Repo/t3-7ba2a879-a5c03526639f6fb5", trees, "/home/a").place).toBe(
      "t3-7ba2a879 (t3/blog)"
    );
    expect(placeOf("/home/a", trees, "/home/a")).toEqual({ place: "~", inRepo: false });
    expect(placeOf("/home/a/substrate/daimon", trees, "/home/a")).toEqual({ place: "~/substrate/daimon", inRepo: false });
  });

  test("encodeProjectDir matches Claude Code's folder names", () => {
    expect(encodeProjectDir("/home/a/Organic-LLM-Cepheus")).toBe("-home-a-Organic-LLM-Cepheus");
    expect(encodeProjectDir("/home/a/.t3/worktrees/Repo/t3-7ba2")).toBe("-home-a--t3-worktrees-Repo-t3-7ba2");
  });
});

describe("ports", () => {
  test("parseSs reads ports and owners, de-duplicating v4/v6 listeners", () => {
    const ss = [
      'LISTEN 0 511 *:3000 *:* users:(("next-server",pid=111,fd=22))',
      'LISTEN 0 511 [::]:3000 [::]:* users:(("next-server",pid=111,fd=23))',
      "LISTEN 0 128 127.0.0.1:6333 0.0.0.0:*",
    ].join("\n");
    expect(parseSs(ss)).toEqual([
      { port: 3000, proc: "next-server", pid: 111 },
      { port: 6333, proc: "?", pid: 0 },
    ]);
  });

  test("parsePortRanges", () => {
    const inRange = parsePortRanges("3000-3999,5173");
    expect([3000, 3999, 5173, 4000, 22].map(inRange)).toEqual([true, true, true, false, false]);
  });
});

describe("claims and overlap", () => {
  test("pathsOverlap treats globs as their directory prefix", () => {
    expect(pathsOverlap("components/chat/**", "components/chat/a.tsx")).toBe(true);
    expect(pathsOverlap("components/chat/*.tsx", "components/chat")).toBe(true);
    expect(pathsOverlap("app/**/page.tsx", "app/blog/x.tsx")).toBe(true);
    expect(pathsOverlap("components/chat/**", "components/chatty.tsx")).toBe(false);
    expect(pathsOverlap("./lib/a", "lib/a/b")).toBe(true);
    expect(pathsOverlap("**", "anything/at/all")).toBe(true);
    expect(pathsOverlap("lib/a", "lib/b")).toBe(false);
  });

  test("a claim is live only while the same process is running", () => {
    const procs = parsePs("4001 1188 1000 claude");
    const now = 1_000_000;
    const claim: Claim = { pid: 4001, kind: "claude", title: "t", paths: [], ports: [], cwd: "/", procStart: now - 1000 };
    expect(claimIsLive(claim, procs, now)).toBe(true);
    // The pid was reused by a younger process.
    expect(claimIsLive({ ...claim, procStart: now - 90_000 }, procs, now)).toBe(false);
    expect(claimIsLive({ ...claim, pid: 9999 }, procs, now)).toBe(false);
  });
});

describe("delta", () => {
  test("only arrivals and departures are reported, in a stable order", () => {
    const prev = { "agent:1": "claude main", "port:3000": "port :3000 next" };
    const next = { "agent:1": "claude main", "agent:2": "codex ~", "claim:2": "claim codex: x" };
    expect(diffSnapshots(prev, next)).toEqual(["+ codex ~", "+ claim codex: x", "- port :3000 next"]);
  });

  test("nothing changed means nothing to say", () => {
    const snap = { "agent:1": "claude main" };
    expect(diffSnapshots(snap, { ...snap })).toEqual([]);
  });

  test("formatAge stays short", () => {
    expect([5, 100, 3600, 9000, 200_000].map(formatAge)).toEqual(["5s", "2m", "60m", "3h", "2d"]);
  });
});
