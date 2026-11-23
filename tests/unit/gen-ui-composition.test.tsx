import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent } from "@testing-library/react";
import { generateText } from "ai";
import { MockLanguageModelV4 } from "ai/test";

import { installBrowserMedia } from "../helpers/browser-media";
import { render } from "../helpers/render";

import { GenUIRenderer } from "@/components/chat/gen-ui/GenUIRenderer";
import { messagePartsToCopyMarkdown } from "@/lib/chat/message-copy-markdown";
import { compileChatTools } from "@/lib/llm/compile-chat-tools";
import { createRenderGenUiTool } from "@/lib/llm/gen-ui-tool";
import { RenderGenUiToolOutputSchema, safeParseGenUIChatBlock } from "@/lib/schemas/gen-ui";
import { CompositionBlockSchema } from "@/lib/schemas/gen-ui/composition";
import { COMPOSITION_EXAMPLES } from "@/lib/schemas/gen-ui/composition-fixtures";
import { FIXTURE_ANSWER_CARD } from "@/lib/schemas/gen-ui/fixtures";

const population = COMPOSITION_EXAMPLES.population;
const release = COMPOSITION_EXAMPLES.release;
const blockWith = (nodes: unknown[]) => ({ ...population, nodes });

describe("Gen UI composition contract", () => {
  test("legacy generation remains default and saved compositions still decode", () => {
    const tool = createRenderGenUiTool();
    const input = tool.inputSchema as typeof RenderGenUiToolOutputSchema;

    expect(input.safeParse({ block: population }).success).toBe(false);
    expect(input.safeParse({ block: FIXTURE_ANSWER_CARD }).success).toBe(true);
    expect(RenderGenUiToolOutputSchema.safeParse({ block: population }).success).toBe(true);
    expect(safeParseGenUIChatBlock(FIXTURE_ANSWER_CARD).ok).toBe(true);
  });

  test("rejects unsupported actions, unsafe sources, and malformed ranges", () => {
    const nodes = [
      { kind: "action", name: "apply" },
      { kind: "text", text: "Hello", onClick: "send" },
      { kind: "source", label: "Bad", url: "javascript:alert(1)" },
      { kind: "source", label: "Bad", url: "https://user:password@example.com/" },
      { kind: "source", label: "Bad", url: "https://example.com/a> [untrusted]" },
      { ...population.nodes[0], rows: [{ label: "Range", range: [30, 10] }] },
      { ...population.nodes[0], rows: [{ label: "Range", range: [10, 30], value: 50 }] },
      { ...population.nodes[0], rows: [{ label: "No value" }] },
    ];

    for (const node of nodes) expect(CompositionBlockSchema.safeParse(blockWith([node])).success).toBe(false);
  });

  test("bounds depth, total nodes, and UTF-8 payload size", () => {
    const text = { kind: "text", text: "Evidence" };
    const details = { kind: "disclosure", label: "Details", children: Array.from({ length: 5 }, () => text) };

    expect(CompositionBlockSchema.safeParse(blockWith(Array(4).fill(details))).success).toBe(true);
    expect(CompositionBlockSchema.safeParse(blockWith(Array(5).fill(details))).success).toBe(false);
    expect(CompositionBlockSchema.safeParse(blockWith([{ ...details, children: [details] }])).success).toBe(false);
    expect(CompositionBlockSchema.safeParse(blockWith(Array(8).fill({ ...text, text: "界".repeat(600) }))).success).toBe(false);
  });

  test("a tool call through the AI SDK round-trips a composition", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: {
        content: [{ type: "tool-call", toolName: "render_gen_ui", toolCallId: "sample", input: JSON.stringify({ block: release }) }],
        finishReason: { unified: "tool-calls", raw: "tool-calls" },
        usage: {
          inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 1, text: 1, reasoning: 0 },
        },
        warnings: [],
      },
    });

    const { toolResults } = await generateText({
      model,
      tools: { render_gen_ui: createRenderGenUiTool({ allowComposition: true }) },
      prompt: "Show a synthetic release plan with readiness scores and activity.",
    });

    expect(toolResults[0]?.output).toEqual({ block: release });
  });

  test("publishes the pilot schema and guidance only in flagged Arcadia", async () => {
    const previous = process.env.GEN_UI_COMPOSITION_PILOT;
    const compile = (experience: "arcadia" | "topic_explore" | "delphi") =>
      compileChatTools({ sbUserId: "synthetic-user", experience, useSearch: false, useMemory: false });

    try {
      delete process.env.GEN_UI_COMPOSITION_PILOT;
      const disabled = await compile("arcadia");
      expect(disabled.tools.render_gen_ui.description).not.toContain('type "composition"');
      process.env.GEN_UI_COMPOSITION_PILOT = "true";
      for (const experience of ["arcadia", "topic_explore", "delphi"] as const) {
        const enabled = await compile(experience);
        const description = enabled.tools.render_gen_ui.description ?? "";

        expect(description.includes('type "composition"')).toBe(experience === "arcadia");
      }
    } finally {
      if (previous === undefined) delete process.env.GEN_UI_COMPOSITION_PILOT;
      else process.env.GEN_UI_COMPOSITION_PILOT = previous;
    }
  });
});

describe("Gen UI composition chat rendering", () => {
  let restoreMedia: () => void;
  beforeEach(() => {
    restoreMedia = installBrowserMedia();
  });
  afterEach(() => {
    cleanup();
    restoreMedia();
  });

  test("Condensed keeps the scale and folds evidence the reader can open", () => {
    const view = render(<GenUIRenderer data={{ block: population }} compositionDensity="condensed" />);
    const details = view.container.querySelector("details");

    expect(view.getByText("20–25%")).toBeTruthy();
    expect(details?.open).toBe(false);
    fireEvent.click(view.getByText("How to read the estimate"));
    expect(details?.open).toBe(true);
    expect(view.getByRole("link", { name: "Example source" }).getAttribute("href")).toBe("https://example.com/population");
  });

  test("Full renders an assembled plan, its numeric rows and open activity", () => {
    const view = render(<GenUIRenderer data={{ block: release }} compositionDensity="full" />);

    expect(view.getByText("Browser coverage")).toBeTruthy();
    expect(view.getAllByRole("list").length).toBe(3);
    expect(view.container.querySelector("details")?.open).toBe(true);
    expect(view.getByText("QA agent prepared the mobile review.")).toBeTruthy();
  });

  test("invalid stored nodes use only the text fallback and copy remains readable", () => {
    const output = { block: { ...population, nodes: [{ kind: "source", label: "Injected", url: "data:text/html,example" }], fallback: "Estimated \u003cimg src=x\u003e" } };
    const view = render(<GenUIRenderer data={output} />);

    expect(view.getByText("Estimated <img src=x>")).toBeTruthy();
    expect(view.container.querySelector("img, a")).toBeNull();

    const parts = [{ type: "tool-render_gen_ui" as const, state: "output-available" as const, toolCallId: "saved", input: {}, output: { block: population } }];
    const markdown = messagePartsToCopyMarkdown(parts);

    expect(markdown).toContain("Share of world population");
    expect(markdown).toContain("point estimate");
    expect(markdown).toContain("https://example.com/population");
  });
});
