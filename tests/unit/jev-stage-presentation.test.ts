import { describe, expect, test } from "bun:test";

import {
  designBriefFromReply,
  preferStagePresentation,
  spokenStageLead,
} from "@/lib/jev-stage/stage-presentation";

describe("jev-stage stage presentation", () => {
  test("keeps short replies in the spoken line", () => {
    const result = preferStagePresentation({
      message: "hi",
      reply: "Hello — glad you’re here.",
      designBrief: null,
    });

    expect(result.promoted).toBe(false);
    expect(result.designBrief).toBeNull();
    expect(result.reply).toBe("Hello — glad you’re here.");
  });

  test("promotes long replies onto a design brief with a short spoken lead", () => {
    const reply =
      "From what I have saved, you seem to be working on a project involving Organic and Aion. You’ve emphasized that people should choose when recurring conversations turn into projects. Your AI sources include ChatGPT, Notion, Claude, and your own judgment.";
    const result = preferStagePresentation({
      message: "What do you know about me?",
      reply,
      designBrief: null,
    });

    expect(result.promoted).toBe(true);
    expect(result.reply.length).toBeLessThan(reply.length);
    expect(result.reply).toMatch(/on Stage/i);
    expect(result.designBrief).toContain("What do you know about me?");
    expect(result.designBrief).toContain("Organic and Aion");
  });

  test("respects an existing design brief", () => {
    const result = preferStagePresentation({
      message: "Show me the plan",
      reply: "x".repeat(400),
      designBrief: "Already queued",
    });

    expect(result.promoted).toBe(false);
    expect(result.designBrief).toBe("Already queued");
  });

  test("spokenStageLead and brief helpers stay bounded", () => {
    expect(spokenStageLead("One fact. Two facts. Three.")).toMatch(/^One fact\./);
    expect(designBriefFromReply("q", "a".repeat(5000)).length).toBeLessThan(2500);
  });
});
