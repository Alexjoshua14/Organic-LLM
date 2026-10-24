import type { UIMessage } from "ai";
import { convertToModelMessages } from "ai";
import { describe, expect, test } from "bun:test";

import {
  contextItemPreview,
  createReadContextItemTool,
  frameContextData,
  selectContextExcerpt,
  type ContextItemSnapshot,
} from "@/lib/llm/subagents/threads/context-items";
import { buildSubagentGoalMessage } from "@/lib/llm/subagents/threads/messages";
import { createBundle } from "@/lib/llm/subagents/worktable/operations";
import { renderDispatchContext, selectDispatchBundles } from "@/lib/llm/subagents/worktable/render";
import { emptyWorktable } from "@/lib/llm/subagents/worktable/types";

const CALL = { toolCallId: "read", messages: [], context: {} };
const item = (text: string, itemId = "owned"): ContextItemSnapshot => ({
  itemId,
  text,
  kind: "note",
  label: null,
  agentId: null,
  sourceMessageId: null,
});
const run = async (
  tool: ReturnType<typeof createReadContextItemTool>,
  input: { itemId: string; offset?: number; limit?: number }
) => {
  const output = await tool.execute!(input, CALL);
  if (Symbol.asyncIterator in output) throw new Error("Expected one page, not streamed output");
  return output;
};

describe("selected context originals", () => {
  test("marks truncation with content-only JS character counts", () => {
    const source = "😀x".repeat(10_000);
    const preview = contextItemPreview(item(source));
    expect(preview.manifest).toMatchObject({
      originalChars: 30_000,
      deliveredChars: 6_000,
      truncated: true,
    });
    expect(preview.content).toBe(
      source.slice(0, 6_000) +
        '\n[TRUNCATED: showing 6000 of 30000 chars. Call read_context_item("owned", offset, limit) for the rest]'
    );
  });

  test("under-cap content and framed tool pages preserve exact source strings", async () => {
    const source = " \n\u0000Ａ\u200b<script>literal source</script>😀\n ";
    expect(contextItemPreview(item(source)).content).toBe(source);
    expect(contextItemPreview(item(source)).manifest.truncated).toBe(false);
    const tool = createReadContextItemTool(async () => [item(source)]);
    const output = await run(tool, { itemId: "owned" });
    expect(output).toMatchObject({
      content: source,
      returnedChars: source.length,
      totalChars: source.length,
      nextOffset: null,
    });
    const framed = await tool.toModelOutput!({
      toolCallId: "read",
      input: { itemId: "owned" },
      output,
    });
    expect(framed.type).toBe("text");
    if (framed.type !== "text") throw new Error("Expected text model output");
    expect(JSON.parse(framed.value).untrustedContext.content).toBe(source);
    expect(framed.value).toContain("untrusted reference data");
  });

  test("paging reassembles the full original exactly", async () => {
    const source = "😀\nＡ\u200bquoted source ".repeat(2_000);
    const tool = createReadContextItemTool(async () => [item(source)]);
    let offset = 0;
    let joined = "";
    do {
      const page = await run(tool, { itemId: "owned", offset });
      if (!("content" in page)) throw new Error(page.error);
      expect(page.returnedChars).toBe(page.content.length);
      expect(page.returnedChars).toBeLessThanOrEqual(8_000);
      joined += page.content;
      if (page.nextOffset === null) break;
      offset = page.nextOffset;
    } while (true);
    expect(joined).toBe(source);
  });

  test("clamps paging bounds and gives a generic error for all unavailable IDs", async () => {
    const tool = createReadContextItemTool(async () => [item("a".repeat(10_000))]);
    expect(await run(tool, { itemId: "owned", offset: -5, limit: 20_000 })).toMatchObject({
      offset: 0,
      returnedChars: 8_000,
      nextOffset: 8_000,
    });
    expect(await run(tool, { itemId: "owned", offset: 50_000 })).toMatchObject({
      content: "",
      returnedChars: 0,
      nextOffset: null,
    });
    expect(await run(tool, { itemId: "owned", limit: -1 })).toMatchObject({ returnedChars: 1 });
    expect(await run(tool, { itemId: "another-worker-id" })).toEqual(
      await run(tool, { itemId: "unknown" })
    );
    const nextDispatch = createReadContextItemTool(async () => [item("new", "new-dispatch")]);
    expect(await run(nextDispatch, { itemId: "owned" })).toEqual(
      await run(tool, { itemId: "unknown" })
    );
  });

  test("an attached excerpt never exposes the unselected source through paging", async () => {
    const selected = selectContextExcerpt("secret-before\nneeded\nsecret-after", {
      offset: 14,
      limit: 6,
    });
    const tool = createReadContextItemTool(async () => [item(selected.text)]);
    expect(await run(tool, { itemId: "owned" })).toMatchObject({
      content: "needed",
      totalChars: 6,
    });
  });

  test("full snapshots persist in metadata but are excluded from model input", async () => {
    const secret = "original remainder unavailable to the preview";
    const assignment = buildSubagentGoalMessage({
      goal: "Review",
      goalId: "goal",
      context: "preview",
      subagentContext: {
        version: 1,
        items: [item(secret)],
        history: { mode: "fresh", messageIds: [] },
      },
    });
    expect(JSON.stringify(assignment.metadata)).toContain(secret);
    expect(JSON.stringify(await convertToModelMessages([assignment as UIMessage]))).not.toContain(
      secret
    );
  });

  test("bundle selection leaves the saved bundle unchanged and deduplicates delivered content", async () => {
    const note = (text: string) => ({
      kind: "note" as const,
      text,
      label: null,
      agentId: null,
      sourceMessageId: null,
    });
    const created = createBundle(
      emptyWorktable(),
      {
        name: "Kit",
        instructions: "Required constraint",
        items: [note("irrelevant"), note("prefix-needed-tail")],
      },
      "now"
    );
    if (!created.ok) throw new Error(created.error);
    const selected = selectDispatchBundles(created.worktable, [
      { bundle: "Kit", items: [{ itemId: created.value.items[1]!.id, offset: 7, limit: 6 }] },
    ]);
    const rendered = await renderDispatchContext({
      bundles: selected.bundles,
      items: [note("needed")],
      resolveLive: async () => null,
    });
    expect(selected.omittedItems).toBe(1);
    expect(rendered.context).toContain("Required constraint");
    expect(rendered.context).not.toContain("irrelevant");
    expect(rendered.context).not.toContain("prefix");
    expect(rendered.manifest[1]?.duplicateOf).toBe(rendered.items[0]?.itemId);
    expect(rendered.manifest[1]?.deliveredChars).toBe(0);
    expect(created.value.items[1]?.text).toBe("prefix-needed-tail");
    expect(() =>
      selectDispatchBundles(created.worktable, [{ bundle: "Kit", items: [{ itemId: "missing" }] }])
    ).toThrow("No item");
    expect(JSON.parse(frameContextData({ content: "data" })).untrustedContext.content).toBe("data");
  });
});
