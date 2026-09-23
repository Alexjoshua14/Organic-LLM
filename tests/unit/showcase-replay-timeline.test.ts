import { describe, expect, test } from "bun:test";
import type { UIMessage } from "ai";

import {
  REPLAY_ASSISTANT_MS_PER_TOKEN,
  REPLAY_COMPOSER_MS_PER_CHAR,
  REPLAY_COMPOSER_SETTLE_MS,
  REPLAY_THINKING_PAUSE_MS,
  REPLAY_TOOL_IN_FLIGHT_MS,
} from "@/lib/showcase/replay-timing";
import {
  compileReplay,
  deriveReplayFrame,
  type ReplaySession,
} from "@/lib/showcase/replay-timeline";

const session: ReplaySession = {
  id: "test-replay",
  chapters: [
    {
      id: "c1",
      title: "Chapter one",
      caption: "First chapter",
      user: "Hello board",
      assistant: [
        { kind: "text", text: "Opening the board now." },
        {
          kind: "tool",
          toolName: "kanban_board",
          toolCallId: "tc-1",
          input: { command: { type: "UPSERT_ITEMS" } },
          output: { kind: "kanban-ack", applied: "UPSERT_ITEMS", count: 1 },
          effect: { type: "UPSERT_ITEMS", id: "fx-1" },
          inFlightMs: REPLAY_TOOL_IN_FLIGHT_MS,
        },
        { kind: "text", text: "Done." },
      ],
    },
    {
      id: "c2",
      title: "Chapter two",
      caption: "Second chapter",
      user: "Next",
      assistant: [{ kind: "text", text: "All set." }],
    },
  ],
};

function isDynamicTool(
  part: UIMessage["parts"][number]
): part is Extract<UIMessage["parts"][number], { type: "dynamic-tool" }> {
  return part.type === "dynamic-tool";
}

describe("showcase replay timeline", () => {
  const timeline = compileReplay(session);

  test("thread is empty at t=0", () => {
    const frame = deriveReplayFrame(timeline, 0);

    expect(frame.messages).toEqual([]);
    expect(frame.composerText).toBe("");
    expect(frame.effectsApplied).toBe(0);
    expect(frame.chapterIndex).toBe(0);
    expect(frame.complete).toBe(false);
  });

  test("composer holds partial text mid-typing", () => {
    const mid = Math.floor((session.chapters[0]!.user.length / 2) * REPLAY_COMPOSER_MS_PER_CHAR);
    const frame = deriveReplayFrame(timeline, mid);

    expect(frame.composerText.length).toBeGreaterThan(0);
    expect(frame.composerText.length).toBeLessThan(session.chapters[0]!.user.length);
    expect(frame.messages).toEqual([]);
  });

  test("tool part is input-streaming before complete and output-available after", () => {
    const chapter = timeline.chapters[0]!;
    const toolStep = chapter.steps.find((s) => s.kind === "tool");

    expect(toolStep?.kind).toBe("tool");
    if (!toolStep || toolStep.kind !== "tool") return;

    const before = deriveReplayFrame(timeline, toolStep.startMs + 10);
    const assistantBefore = before.messages.find((m) => m.role === "assistant");
    const streamingPart = assistantBefore?.parts.find(isDynamicTool);

    expect(streamingPart?.state).toBe("input-streaming");
    expect(before.effectsApplied).toBe(0);
    expect(before.pendingEffect).toEqual({ type: "UPSERT_ITEMS", id: "fx-1" });

    const after = deriveReplayFrame(timeline, toolStep.completeMs);
    const assistantAfter = after.messages.find((m) => m.role === "assistant");
    const donePart = assistantAfter?.parts.find(isDynamicTool);

    expect(donePart?.state).toBe("output-available");
    expect(after.effectsApplied).toBe(1);
    expect(after.pendingEffect).toBeUndefined();
  });

  test("everything is finished at the end", () => {
    const frame = deriveReplayFrame(timeline, timeline.durationMs);

    expect(frame.complete).toBe(true);
    expect(frame.messages.length).toBe(4);
    expect(frame.effectsApplied).toBe(1);
    expect(frame.composerText).toBe("");
    expect(frame.status).toBe("ready");
  });

  test("effectsApplied never decreases across increasing t", () => {
    let prev = 0;

    for (let t = 0; t <= timeline.durationMs; t += 250) {
      const frame = deriveReplayFrame(timeline, t);

      expect(frame.effectsApplied).toBeGreaterThanOrEqual(prev);
      prev = frame.effectsApplied;
    }
  });

  test("finished messages keep object identity across frames", () => {
    const chapter = timeline.chapters[0]!;
    const afterChapter = deriveReplayFrame(timeline, chapter.chapterEndMs);
    const later = deriveReplayFrame(timeline, chapter.chapterEndMs + 100);

    expect(afterChapter.messages[0]).toBe(later.messages[0]);
    expect(afterChapter.messages[1]).toBe(later.messages[1]);
    expect(afterChapter.messages[0]).toBe(timeline.finishedUserByChapter[0]);
    expect(afterChapter.messages[1]).toBe(timeline.finishedAssistantByChapter[0]);
  });

  test("user bubble appears after typing + settle, then thinking", () => {
    const typingMs = session.chapters[0]!.user.length * REPLAY_COMPOSER_MS_PER_CHAR;
    const appear = typingMs + REPLAY_COMPOSER_SETTLE_MS;
    const frame = deriveReplayFrame(timeline, appear);

    expect(frame.messages).toHaveLength(1);
    expect(frame.messages[0]?.role).toBe("user");
    expect(frame.status).toBe("submitted");

    const streaming = deriveReplayFrame(timeline, appear + REPLAY_THINKING_PAUSE_MS);

    expect(streaming.status).toBe("streaming");
    expect(streaming.messages.some((m) => m.role === "assistant")).toBe(true);
  });

  test("assistant text streams by token budget", () => {
    const chapter = timeline.chapters[0]!;
    const textStep = chapter.steps.find((s) => s.kind === "text");

    expect(textStep?.kind).toBe("text");
    if (!textStep || textStep.kind !== "text") return;

    const mid = deriveReplayFrame(
      timeline,
      textStep.startMs + REPLAY_ASSISTANT_MS_PER_TOKEN * 2
    );
    const assistant = mid.messages.find((m) => m.role === "assistant");
    const textPart = assistant?.parts.find((p) => p.type === "text");

    expect(textPart && textPart.type === "text" ? textPart.text.length : 0).toBeGreaterThan(0);
    expect(textPart && textPart.type === "text" ? textPart.text : "").not.toBe(textStep.fullText);
  });
});
