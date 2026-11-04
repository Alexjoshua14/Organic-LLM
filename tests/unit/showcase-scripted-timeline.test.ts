import { describe, expect, test } from "bun:test";

import {
  beatProgressAt,
  compileScript,
  deriveScriptFrame,
  hasReachedBeat,
  scriptChapterSettledTimes,
  scriptChapterStarts,
  type ScriptSession,
} from "@/lib/showcase/scripted-timeline";
import { chapterSettledTimes, compileReplay } from "@/lib/showcase/replay-timeline";

const session: ScriptSession = {
  id: "test-script",
  endHoldMs: 500,
  chapters: [
    {
      id: "inspect",
      title: "Inspect",
      caption: "Open the inspector.",
      beats: [
        { id: "open", durationMs: 1000 },
        { id: "read", durationMs: 2000 },
      ],
    },
    {
      id: "change",
      title: "Change",
      caption: "Raise effort.",
      beats: [{ id: "raise", durationMs: 1500 }],
    },
  ],
};

describe("compileScript", () => {
  test("lays beats end to end and adds the end hold", () => {
    const script = compileScript(session);

    expect(script.beats.map((b) => [b.id, b.startMs, b.endMs])).toEqual([
      ["open", 0, 1000],
      ["read", 1000, 3000],
      ["raise", 3000, 4500],
    ]);
    expect(script.chapters.map((c) => [c.startMs, c.endMs])).toEqual([
      [0, 3000],
      [3000, 4500],
    ]);
    expect(script.contentEndMs).toBe(4500);
    expect(script.durationMs).toBe(5000);
  });

  test("rejects authoring errors", () => {
    expect(() => compileScript({ id: "x", chapters: [] })).toThrow();
    expect(() =>
      compileScript({ id: "x", chapters: [{ id: "c", title: "", caption: "", beats: [] }] })
    ).toThrow();
    expect(() =>
      compileScript({
        id: "x",
        chapters: [
          {
            id: "c",
            title: "",
            caption: "",
            beats: [
              { id: "a", durationMs: 1 },
              { id: "a", durationMs: 1 },
            ],
          },
        ],
      })
    ).toThrow(/repeats beat id/);
    expect(() =>
      compileScript({
        id: "x",
        chapters: [{ id: "c", title: "", caption: "", beats: [{ id: "a", durationMs: 0 }] }],
      })
    ).toThrow(/positive duration/);
  });
});

describe("deriveScriptFrame", () => {
  const script = compileScript(session);

  test("finds the active beat and its progress", () => {
    expect(deriveScriptFrame(script, 0)).toMatchObject({
      beatId: "open",
      chapterIndex: 0,
      beatProgress: 0,
      complete: false,
    });
    expect(deriveScriptFrame(script, 2000)).toMatchObject({
      beatId: "read",
      chapterIndex: 0,
      beatProgress: 0.5,
    });
    expect(deriveScriptFrame(script, 3000)).toMatchObject({ beatId: "raise", chapterIndex: 1 });
  });

  test("holds the last beat at full progress through the end hold", () => {
    expect(deriveScriptFrame(script, 4800)).toMatchObject({
      beatId: "raise",
      beatProgress: 1,
      complete: false,
    });
    expect(deriveScriptFrame(script, 99_999)).toMatchObject({
      tMs: 5000,
      beatId: "raise",
      complete: true,
    });
    expect(deriveScriptFrame(script, -10).tMs).toBe(0);
  });

  test("beat helpers accumulate state", () => {
    expect(hasReachedBeat(script, 999, "read")).toBe(false);
    expect(hasReachedBeat(script, 1000, "read")).toBe(true);
    expect(beatProgressAt(script, 500, "read")).toBe(0);
    expect(beatProgressAt(script, 2000, "read")).toBe(0.5);
    expect(beatProgressAt(script, 3500, "read")).toBe(1);
    expect(() => hasReachedBeat(script, 0, "missing")).toThrow();
  });

  test("chapter seek targets", () => {
    expect(scriptChapterStarts(script)).toEqual([0, 3000]);
    const settled = scriptChapterSettledTimes(script);

    expect(settled).toEqual([2999, 4499]);
    // A settled time stays inside its own chapter.
    settled.forEach((t, index) => expect(deriveScriptFrame(script, t).chapterIndex).toBe(index));
  });
});

describe("chapterSettledTimes (chat replay)", () => {
  test("lands on each chapter's finished assistant turn", () => {
    const timeline = compileReplay({
      id: "settle",
      chapters: [
        { id: "a", title: "A", caption: "", user: "Hi", assistant: [{ kind: "text", text: "Hello there." }] },
        { id: "b", title: "B", caption: "", user: "More", assistant: [{ kind: "text", text: "Sure." }] },
      ],
    });

    expect(chapterSettledTimes(timeline)).toEqual(timeline.chapters.map((c) => c.assistantEndMs));
    timeline.chapters.forEach((c) => expect(c.assistantEndMs).toBeLessThan(c.chapterEndMs));
  });
});
