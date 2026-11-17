import { describe, expect, mock, test } from "bun:test";

import type { ThreadLink } from "@/types";

import {
  buildLauncherIdeas,
  formatIdeaAge,
  launcherIdeaLayout,
  moveIdeaFocus,
  openLauncherIdea,
  rankLauncherIdeas,
  type LauncherIdea,
} from "@/lib/launcher/launcher-ideas";

function thread(partial: Partial<ThreadLink> & { id: string }): ThreadLink {
  return {
    title: partial.id,
    pinned: false,
    date: "2026-11-11T12:00:00.000Z",
    ...partial,
  };
}

function idea(partial: Partial<LauncherIdea> & { id: string }): LauncherIdea {
  return {
    title: partial.id,
    href: `/chat/${partial.id}`,
    feature: undefined,
    date: "2026-11-11T12:00:00.000Z",
    cue: null,
    ...partial,
  };
}

describe("buildLauncherIdeas", () => {
  test("orders by recency and ignores pins", () => {
    const ideas = buildLauncherIdeas({
      threads: [
        thread({ id: "old-pinned", pinned: true, date: "2026-11-01T00:00:00.000Z" }),
        thread({ id: "newest", date: "2026-11-11T09:00:00.000Z" }),
        thread({ id: "middle", date: "2026-11-05T00:00:00.000Z" }),
      ],
      cueById: new Map(),
      activeThreadId: null,
    });

    expect(ideas.map((i) => i.id)).toEqual(["newest", "middle", "old-pinned"]);
  });

  test("never offers the thread already on screen, and drops duplicates", () => {
    const ideas = buildLauncherIdeas({
      threads: [thread({ id: "here" }), thread({ id: "a" }), thread({ id: "a" })],
      cueById: new Map(),
      activeThreadId: "here",
    });

    expect(ideas.map((i) => i.id)).toEqual(["a"]);
  });

  test("opens the same path the sidebar would: the row's href, else /chat/<id>", () => {
    const ideas = buildLauncherIdeas({
      threads: [
        thread({ id: "arc", href: "/sandbox/arcadia/arc" }),
        thread({ id: "plain", date: "2026-11-10T00:00:00.000Z" }),
      ],
      cueById: new Map(),
      activeThreadId: null,
    });

    expect(ideas.map((i) => i.href)).toEqual(["/sandbox/arcadia/arc", "/chat/plain"]);
  });

  test("attaches cues by thread id and names untitled threads", () => {
    const ideas = buildLauncherIdeas({
      threads: [thread({ id: "a", title: "  " }), thread({ id: "b" })],
      cueById: new Map([["a", "Choosing between capture and save"]]),
      activeThreadId: null,
    });

    expect(ideas.find((i) => i.id === "a")).toMatchObject({
      title: "Untitled chat",
      cue: "Choosing between capture and save",
    });
    expect(ideas.find((i) => i.id === "b")?.cue).toBeNull();
  });

  test("keeps list order when dates are unusable", () => {
    const ideas = buildLauncherIdeas({
      threads: [thread({ id: "x", date: "nope" }), thread({ id: "y", date: "also nope" })],
      cueById: new Map(),
      activeThreadId: null,
    });

    expect(ideas.map((i) => i.id)).toEqual(["x", "y"]);
  });
});

describe("rankLauncherIdeas", () => {
  const ideas = [
    idea({ id: "1", title: "Weekend plans" }),
    idea({ id: "2", title: "Ergon intake", cue: "Choosing automatic capture or explicit saving" }),
    idea({ id: "3", title: "Memory visualization", feature: "rabbit_hole" }),
    idea({ id: "4", title: "Café notes" }),
  ];

  test("an empty query is the most recent ideas, capped", () => {
    expect(rankLauncherIdeas(ideas, "  ", 2).map((i) => i.id)).toEqual(["1", "2"]);
  });

  test("every word must match somewhere", () => {
    expect(rankLauncherIdeas(ideas, "ergon capture", 5).map((i) => i.id)).toEqual(["2"]);
    expect(rankLauncherIdeas(ideas, "ergon weekend", 5)).toEqual([]);
  });

  test("a title prefix beats a cue-only match, and recency breaks ties", () => {
    const list = [
      idea({ id: "cue", title: "Something else", cue: "about memory" }),
      idea({ id: "title", title: "Memory map" }),
      idea({ id: "title-2", title: "Memory notes" }),
    ];

    expect(rankLauncherIdeas(list, "memory", 5).map((i) => i.id)).toEqual([
      "title",
      "title-2",
      "cue",
    ]);
  });

  test("matches the experience name and ignores accents and case", () => {
    expect(rankLauncherIdeas(ideas, "rabbit", 5).map((i) => i.id)).toEqual(["3"]);
    expect(rankLauncherIdeas(ideas, "CAFE", 5).map((i) => i.id)).toEqual(["4"]);
  });

  test("a mid-title word start outranks a plain substring", () => {
    const list = [
      idea({ id: "sub", title: "Reintake form" }),
      idea({ id: "word", title: "Ergon intake" }),
    ];

    expect(rankLauncherIdeas(list, "intake", 5).map((i) => i.id)).toEqual(["word", "sub"]);
  });
});

describe("launcherIdeaLayout", () => {
  test("never needs scrolling: five wide, four medium, a 2x2 on phones", () => {
    expect(launcherIdeaLayout(1280)).toEqual({ limit: 5, columns: 5 });
    expect(launcherIdeaLayout(1024)).toEqual({ limit: 5, columns: 5 });
    expect(launcherIdeaLayout(800)).toEqual({ limit: 4, columns: 4 });
    expect(launcherIdeaLayout(390)).toEqual({ limit: 4, columns: 2 });
  });
});

describe("moveIdeaFocus", () => {
  const base = { count: 5, columns: 5 };

  test("left and right move within the row and stop at the ends", () => {
    expect(moveIdeaFocus({ ...base, index: 2, key: "ArrowRight" })).toEqual({
      kind: "index",
      index: 3,
    });
    expect(moveIdeaFocus({ ...base, index: 0, key: "ArrowLeft" })).toEqual({ kind: "stay" });
    expect(moveIdeaFocus({ ...base, index: 4, key: "ArrowRight" })).toEqual({ kind: "stay" });
  });

  test("up from the first row returns to the input", () => {
    expect(moveIdeaFocus({ ...base, index: 2, key: "ArrowUp" })).toEqual({ kind: "input" });
  });

  test("in a 2x2 grid, up and down move between rows", () => {
    const grid = { count: 4, columns: 2 };

    expect(moveIdeaFocus({ ...grid, index: 0, key: "ArrowDown" })).toEqual({
      kind: "index",
      index: 2,
    });
    expect(moveIdeaFocus({ ...grid, index: 3, key: "ArrowUp" })).toEqual({
      kind: "index",
      index: 1,
    });
    expect(moveIdeaFocus({ ...grid, index: 3, key: "ArrowDown" })).toEqual({ kind: "stay" });
  });

  test("down into a short last row lands on its last card", () => {
    expect(moveIdeaFocus({ count: 3, columns: 2, index: 1, key: "ArrowDown" })).toEqual({
      kind: "index",
      index: 2,
    });
  });

  test("home, end, other keys, and an empty grid", () => {
    expect(moveIdeaFocus({ ...base, index: 3, key: "Home" })).toEqual({ kind: "index", index: 0 });
    expect(moveIdeaFocus({ ...base, index: 1, key: "End" })).toEqual({ kind: "index", index: 4 });
    expect(moveIdeaFocus({ ...base, index: 1, key: "x" })).toEqual({ kind: "stay" });
    expect(moveIdeaFocus({ count: 0, columns: 5, index: 0, key: "ArrowDown" })).toEqual({
      kind: "input",
    });
  });
});

describe("openLauncherIdea", () => {
  test("selects the thread, closes, then pushes its path: the sidebar's own sequence", () => {
    const calls: string[] = [];
    const setChatId = mock((id: string) => void calls.push(`select:${id}`));
    const close = mock(() => void calls.push("close"));
    const push = mock((href: string) => void calls.push(`push:${href}`));

    openLauncherIdea({ id: "t1", href: "/chat/t1" }, { setChatId, close, push });

    expect(calls).toEqual(["select:t1", "close", "push:/chat/t1"]);
  });

  test("hands over nothing but identity: no cached thread content travels with the click", () => {
    const push = mock((_href: string) => {});

    openLauncherIdea(
      { id: "t1", href: "/chat/t1", ...({ cue: "private summary" } as object) },
      { setChatId: () => {}, close: () => {}, push }
    );

    expect(push.mock.calls).toEqual([["/chat/t1"]]);
  });
});

describe("formatIdeaAge", () => {
  const now = Date.parse("2026-11-11T12:00:00.000Z");

  test("compact ages", () => {
    expect(formatIdeaAge("2026-11-11T11:59:40.000Z", now)).toBe("now");
    expect(formatIdeaAge("2026-11-11T11:15:00.000Z", now)).toBe("45m");
    expect(formatIdeaAge("2026-11-11T07:00:00.000Z", now)).toBe("5h");
    expect(formatIdeaAge("2026-11-08T12:00:00.000Z", now)).toBe("3d");
    expect(formatIdeaAge("2026-10-21T12:00:00.000Z", now)).toBe("3w");
    expect(formatIdeaAge("2026-05-11T12:00:00.000Z", now)).toBe("6mo");
  });

  test("an unusable or future date never throws or goes negative", () => {
    expect(formatIdeaAge("nope", now)).toBe("");
    expect(formatIdeaAge("2026-11-12T12:00:00.000Z", now)).toBe("now");
  });
});
