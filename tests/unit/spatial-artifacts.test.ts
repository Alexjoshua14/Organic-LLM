import { describe, expect, test } from "bun:test";
import type { UIMessage } from "ai";

import { spatialArtifactId } from "@/lib/spatial-artifacts/artifact-id";
import { extractGenUIArtifactsFromMessages } from "@/lib/spatial-artifacts/extract-from-messages";
import {
  artifactMatchesFilter,
  primaryZoneForBlockType,
  slotKey,
  visibleZonesForFilter,
} from "@/lib/spatial-artifacts/zone-routing";
import {
  FIXTURE_ANSWER_CARD,
  FIXTURE_AUDIO_SNIPPET,
  FIXTURE_INVALID_BLOCK,
  FIXTURE_PLAN_TIMELINE,
} from "@/lib/schemas/gen-ui/fixtures";

describe("spatialArtifactId", () => {
  test("uses toolCallId when present", () => {
    expect(
      spatialArtifactId({
        threadId: "thread-1",
        toolCallId: "call_abc",
        messageId: "msg-1",
        partIndex: 0,
      })
    ).toBe("thread-1:call_abc");
  });

  test("falls back to messageId and partIndex", () => {
    expect(
      spatialArtifactId({
        threadId: "thread-1",
        messageId: "msg-1",
        partIndex: 2,
      })
    ).toBe("thread-1:msg-1:2");
  });
});

describe("extractGenUIArtifactsFromMessages", () => {
  test("extracts render_gen_ui output", () => {
    const artifacts = extractGenUIArtifactsFromMessages(
      [
        {
          id: "msg-a",
          role: "assistant",
          parts: [
            {
              type: "dynamic-tool",
              toolName: "render_gen_ui",
              toolCallId: "call_1",
              state: "output-available",
              output: { block: FIXTURE_PLAN_TIMELINE },
            } as UIMessage["parts"][number],
          ],
        },
      ] as UIMessage[],
      "thread-xyz"
    );

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]?.block.type).toBe("plan-timeline");
    expect(artifacts[0]?.id).toBe("thread-xyz:call_1");
  });

  test("skips non-assistant messages and invalid tool output", () => {
    const artifacts = extractGenUIArtifactsFromMessages(
      [
        {
          id: "msg-user",
          role: "user",
          parts: [{ type: "text", text: "hello" }],
        },
        {
          id: "msg-pending",
          role: "assistant",
          parts: [
            {
              type: "dynamic-tool",
              toolName: "render_gen_ui",
              toolCallId: "call_pending",
              state: "input-available",
              input: {},
            } as UIMessage["parts"][number],
          ],
        },
        {
          id: "msg-bad",
          role: "assistant",
          parts: [
            {
              type: "dynamic-tool",
              toolName: "render_gen_ui",
              toolCallId: "call_bad",
              state: "output-available",
              output: { block: FIXTURE_INVALID_BLOCK },
            } as UIMessage["parts"][number],
          ],
        },
      ] as UIMessage[],
      "thread-xyz"
    );

    expect(artifacts).toHaveLength(0);
  });

  test("extracts multiple block types from one thread", () => {
    const artifacts = extractGenUIArtifactsFromMessages(
      [
        {
          id: "msg-a",
          role: "assistant",
          parts: [
            {
              type: "dynamic-tool",
              toolName: "render_gen_ui",
              toolCallId: "call_plan",
              state: "output-available",
              output: { block: FIXTURE_PLAN_TIMELINE },
            } as UIMessage["parts"][number],
            {
              type: "dynamic-tool",
              toolName: "render_gen_ui",
              toolCallId: "call_audio",
              state: "output-available",
              output: { block: FIXTURE_AUDIO_SNIPPET },
            } as UIMessage["parts"][number],
          ],
        },
      ] as UIMessage[],
      "thread-xyz"
    );

    expect(artifacts).toHaveLength(2);
    expect(artifacts.map((a) => a.blockType)).toEqual(["plan-timeline", "audio-snippet"]);
  });

  test("falls back to messageId:partIndex id when toolCallId is empty", () => {
    const artifacts = extractGenUIArtifactsFromMessages(
      [
        {
          id: "msg-fallback",
          role: "assistant",
          parts: [
            {
              type: "dynamic-tool",
              toolName: "render_gen_ui",
              state: "output-available",
              output: { block: FIXTURE_ANSWER_CARD },
            } as UIMessage["parts"][number],
          ],
        },
      ] as UIMessage[],
      "thread-xyz"
    );

    expect(artifacts[0]?.id).toBe("thread-xyz:msg-fallback:0");
  });
});

describe("zone-routing", () => {
  test("routes block types to zones", () => {
    expect(primaryZoneForBlockType("plan-timeline")).toBe("plans");
    expect(primaryZoneForBlockType("audio-snippet")).toBe("audio");
    expect(primaryZoneForBlockType("answer-card")).toBe("bookshelf");
  });

  test("filter pinned", () => {
    expect(artifactMatchesFilter("plan-timeline", true, "pinned")).toBe(true);
    expect(artifactMatchesFilter("plan-timeline", false, "pinned")).toBe(false);
  });

  test("filter plans, audio, guides, and all", () => {
    expect(artifactMatchesFilter("plan-timeline", false, "plans")).toBe(true);
    expect(artifactMatchesFilter("audio-snippet", false, "audio")).toBe(true);
    expect(artifactMatchesFilter("answer-card", false, "guides")).toBe(true);
    expect(artifactMatchesFilter("decision-matrix", false, "guides")).toBe(true);
    expect(artifactMatchesFilter("plan-timeline", false, "audio")).toBe(false);
    expect(artifactMatchesFilter("answer-card", false, "all")).toBe(true);
  });

  test("visibleZonesForFilter maps filters to zones", () => {
    expect(visibleZonesForFilter("plans")).toEqual(["plans"]);
    expect(visibleZonesForFilter("audio")).toEqual(["audio"]);
    expect(visibleZonesForFilter("guides")).toEqual(["bookshelf"]);
    expect(visibleZonesForFilter("all")).toBe("all");
    expect(visibleZonesForFilter("pinned")).toBe("all");
  });

  test("slotKey format", () => {
    expect(slotKey("plan-condensed", "a:b")).toBe("plan-condensed:a:b");
  });
});
