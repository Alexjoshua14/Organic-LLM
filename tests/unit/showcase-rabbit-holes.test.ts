import { describe, expect, test } from "bun:test";

import { RabbitHoleSessionSchema } from "@/lib/schemas/rabbitHoleSchemas";
import {
  BAY_NODE_ID,
  ROOT_NODE_ID,
  deriveRabbitHoleDemoState,
  rabbitHoleDemoSession,
  RABBIT_HOLES_SCRIPT,
} from "@/lib/showcase/rabbit-holes";
import { SHOWCASE_STORY } from "@/lib/showcase/showcase-story";
import { compileScript } from "@/lib/showcase/scripted-timeline";

describe("rabbit holes showcase", () => {
  test("session fixture parses with RabbitHoleSessionSchema", () => {
    const parsed = RabbitHoleSessionSchema.parse(rabbitHoleDemoSession);
    const root = parsed.nodesById[ROOT_NODE_ID];

    expect(parsed.sessionId).toBe(rabbitHoleDemoSession.sessionId);
    expect(parsed.rootNodeId).toBe(ROOT_NODE_ID);
    expect(parsed.path.map((segment) => segment.nodeId)).toEqual([ROOT_NODE_ID, BAY_NODE_ID]);
    expect(parsed.activeNodeId).toBe(BAY_NODE_ID);
    expect(root?.summary).toContain(SHOWCASE_STORY.science.coreDistance);
    expect(root?.summary).toContain(SHOWCASE_STORY.home);
    expect(root?.keyTakeaways.length).toBeGreaterThanOrEqual(3);
    expect(root?.keyTakeaways.length).toBeLessThanOrEqual(6);

    const points = root?.keyTakeaways.join(" ") ?? "";

    expect(points).toContain("26,000");
    expect(points).toContain("March through October");
    expect(points.toLowerCase()).toContain("new moon");
    expect(points).toContain("Bortle");
    expect(points.toLowerCase()).toContain("skyglow");
    expect(points).toContain(SHOWCASE_STORY.home);
  });

  test("script compiles to Topic, Summary, and Branch in about ten seconds", () => {
    const script = compileScript(RABBIT_HOLES_SCRIPT);

    expect(script.chapters.map((chapter) => chapter.title)).toEqual([
      "Topic",
      "Summary",
      "Branch",
    ]);
    expect(script.contentEndMs).toBeGreaterThanOrEqual(8_000);
    expect(script.contentEndMs).toBeLessThanOrEqual(12_000);
    expect(script.durationMs - script.contentEndMs).toBe(1_200);
  });

  test("the branch beat has both path nodes and the child active", () => {
    const script = compileScript(RABBIT_HOLES_SCRIPT);
    const branch = script.beats.find((beat) => beat.id === "branch");

    expect(branch).toBeDefined();

    const before = deriveRabbitHoleDemoState(branch!.startMs - 1);

    expect(before.showSummary).toBe(true);
    expect(before.showBranchSuggestions).toBe(true);
    expect(before.pathNodeIds).toEqual([ROOT_NODE_ID]);
    expect(before.activeNodeId).toBe(ROOT_NODE_ID);
    expect(before.session.path.map((segment) => segment.nodeId)).toEqual([ROOT_NODE_ID]);

    const atBranch = deriveRabbitHoleDemoState(branch!.startMs);

    expect(atBranch.phase).toBe("branch");
    expect(atBranch.pathNodeIds).toEqual([ROOT_NODE_ID, BAY_NODE_ID]);
    expect(atBranch.activeNodeId).toBe(BAY_NODE_ID);
    expect(atBranch.session.path.map((segment) => segment.nodeId)).toEqual([
      ROOT_NODE_ID,
      BAY_NODE_ID,
    ]);
    expect(atBranch.session.activeNodeId).toBe(BAY_NODE_ID);
    expect(atBranch.session.nodesById[BAY_NODE_ID]?.summary).toBeTruthy();
  });
});
