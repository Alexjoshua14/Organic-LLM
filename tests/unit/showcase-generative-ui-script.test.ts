import { describe, expect, test } from "bun:test";

import {
  GEN_UI_VIEW_IDS,
  deriveGenUiDemo,
  genUiCompiledScript,
} from "@/lib/showcase/generative-ui-script";
import { scriptChapterSettledTimes, scriptChapterStarts } from "@/lib/showcase/scripted-timeline";

describe("generative UI showcase script", () => {
  test("gives every finished block time to be read before the next request", () => {
    for (const view of GEN_UI_VIEW_IDS) {
      const read = genUiCompiledScript.beats.find((b) => b.id === `${view}-read`)!;

      expect(read.endMs - read.startMs).toBeGreaterThanOrEqual(3_000);
      expect(deriveGenUiDemo(read.startMs).block).toBe("ready");
    }
  });

  test("keeps one chapter per format", () => {
    expect(genUiCompiledScript.chapters.map((c) => c.id)).toEqual([...GEN_UI_VIEW_IDS]);
  });

  test("types the request, answers, then builds the block, in that order", () => {
    const start = scriptChapterStarts(genUiCompiledScript)[0]!;
    const opening = deriveGenUiDemo(start);

    expect(opening).toMatchObject({ view: "compare", showReply: false, block: "hidden" });
    expect(opening.askProgress).toBe(0);

    const answer = genUiCompiledScript.beats.find((b) => b.id === "compare-answer")!;

    expect(deriveGenUiDemo(answer.startMs)).toMatchObject({ askProgress: 1, showReply: true });

    const build = genUiCompiledScript.beats.find((b) => b.id === "compare-build")!;

    expect(deriveGenUiDemo(build.startMs).block).toBe("building");
    expect(deriveGenUiDemo(build.endMs - 1).block).toBe("ready");
  });

  test("every chapter's settled frame shows its finished block", () => {
    scriptChapterSettledTimes(genUiCompiledScript).forEach((t, index) => {
      expect(deriveGenUiDemo(t)).toMatchObject({
        view: GEN_UI_VIEW_IDS[index],
        chapterIndex: index,
        showReply: true,
        block: "ready",
      });
    });
  });
});
