import { describe, expect, test } from "bun:test";

import { demoTrace } from "@/lib/showcase/demo-trace";

describe("showcase demo trace", () => {
  test("has seven ordered stages and expected ids", () => {
    expect(demoTrace.stages.length).toBe(7);
    const ids = demoTrace.stages.map((s) => s.id);
    expect(ids).toEqual(["input", "context", "memory", "tools", "budget", "render", "tts"]);
  });

  test("context stage includes model and pipeline steps", () => {
    const ctx = demoTrace.stages[1];
    expect(ctx.id).toBe("context");
    if (ctx.id !== "context") return;
    expect(ctx.artifact.selectedModelId).toBe("anthropic/claude-sonnet-4.6");
    expect(ctx.artifact.incomingMessage).toContain("retrieval-augmented generation");
    expect(ctx.artifact.contextPackSteps.length).toBeGreaterThanOrEqual(3);
  });

  test("tool routing calls are marked server or client", () => {
    const tools = demoTrace.stages[3];
    expect(tools.id).toBe("tools");
    if (tools.id !== "tools") return;
    for (const c of tools.artifact.toolCalls) {
      expect(["server", "client"]).toContain(c.execution);
    }
  });

  test("budget stage includes aiAction timeline", () => {
    const budget = demoTrace.stages[4];
    expect(budget.id).toBe("budget");
    if (budget.id !== "budget") return;
    expect(budget.artifact.aiActionTimeline.length).toBeGreaterThanOrEqual(3);
    expect(budget.artifact.aiActionTimeline[0]?.action).toBe("processing");
  });

  test("final response markdown matches render stage raw markdown", () => {
    const render = demoTrace.stages[5];
    expect(render.id).toBe("render");
    if (render.id !== "render") return;
    expect(demoTrace.finalResponse.markdown).toBe(render.artifact.rawMarkdown);
  });

  test("tool cards align between finalResponse and render artifact", () => {
    const render = demoTrace.stages[5];
    expect(render.id).toBe("render");
    if (render.id !== "render") return;
    expect(JSON.stringify(demoTrace.finalResponse.toolCards)).toBe(
      JSON.stringify(render.artifact.toolCards)
    );
  });

  test("tts stage references bundled public audio", () => {
    const tts = demoTrace.stages[6];
    expect(tts.id).toBe("tts");
    if (tts.id !== "tts") return;
    expect(tts.artifact.audioUrl).toBe("/showcase/anatomy-demo-audio.wav");
  });
});
