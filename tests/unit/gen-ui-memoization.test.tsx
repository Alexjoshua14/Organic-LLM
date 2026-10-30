import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { Chat } from "@ai-sdk/react";
import { cleanup } from "@testing-library/react";
import type { UIMessage, UIMessageChunk } from "ai";
import * as ReactMarkdownModule from "react-markdown";

import { AnswerCard } from "@/components/chat/gen-ui/blocks/AnswerCard";
import { GenUIMarkdown } from "@/components/chat/gen-ui/GenUIMarkdown";
import { GenUIToolResult } from "@/components/chat/gen-ui/GenUIToolResult";
import { RENDER_GEN_UI_TOOL_NAME } from "@/lib/llm/gen-ui-tool";
import * as GenUISchemas from "@/lib/schemas/gen-ui";
import type { AnswerCardBlock } from "@/lib/schemas/gen-ui";
import { FIXTURE_ANSWER_CARD } from "@/lib/schemas/gen-ui/fixtures";
import { render } from "../helpers/render";

/**
 * A finished gen-ui card should not re-validate or re-parse its markdown while the rest of its
 * message streams. Spies count real work: `safeParseGenUIBlock` (schema validation) and
 * `ReactMarkdown` renders (one per GenUIMarkdown field that actually renders).
 */

const spies: { mockRestore: () => void }[] = [];

function spy<T extends object, K extends keyof T>(module: T, key: K) {
  // @ts-expect-error -- bun's spyOn typing rejects module namespace keys it handles at runtime.
  const s = spyOn(module, key);

  spies.push(s);

  return s as { mock: { calls: unknown[][] } };
}

afterEach(() => {
  while (spies.length > 0) spies.pop()?.mockRestore();
  cleanup();
});

const output = { block: FIXTURE_ANSWER_CARD };

describe("GenUIToolResult", () => {
  test("skips validation and markdown when the parent re-renders with the same output", () => {
    const parse = spy(GenUISchemas, "safeParseGenUIBlock");
    const markdown = spy(ReactMarkdownModule, "default");
    const view = render(<GenUIToolResult messageId="m1" output={output} partIndex={0} />);
    const firstMarkdownRenders = markdown.mock.calls.length;

    expect(parse.mock.calls.length).toBe(1);
    expect(firstMarkdownRenders).toBeGreaterThan(0);

    // A streaming chunk elsewhere in the message: new props object, same `output` reference.
    view.rerender(<GenUIToolResult messageId="m1" output={output} partIndex={0} />);
    view.rerender(<GenUIToolResult messageId="m1" output={output} partIndex={0} />);

    expect(parse.mock.calls.length).toBe(1);
    expect(markdown.mock.calls.length).toBe(firstMarkdownRenders);
  });

  test("re-validates when the output object changes", () => {
    const parse = spy(GenUISchemas, "safeParseGenUIBlock");
    const view = render(<GenUIToolResult messageId="m1" output={output} partIndex={0} />);

    view.rerender(
      <GenUIToolResult messageId="m1" output={structuredClone(output)} partIndex={0} />
    );

    expect(parse.mock.calls.length).toBe(2);
  });
});

describe("GenUIMarkdown", () => {
  test("re-parses only when its text or mode changes", () => {
    const markdown = spy(ReactMarkdownModule, "default");
    const view = render(<GenUIMarkdown inline>{"**a**"}</GenUIMarkdown>);

    view.rerender(<GenUIMarkdown inline>{"**a**"}</GenUIMarkdown>);
    expect(markdown.mock.calls.length).toBe(1);

    view.rerender(<GenUIMarkdown inline>{"**a** b"}</GenUIMarkdown>);
    expect(markdown.mock.calls.length).toBe(2);

    view.rerender(<GenUIMarkdown>{"**a** b"}</GenUIMarkdown>);
    expect(markdown.mock.calls.length).toBe(3);
  });

  test("a card streaming in re-parses only the field that grew", () => {
    const block = FIXTURE_ANSWER_CARD as AnswerCardBlock;
    const markdown = spy(ReactMarkdownModule, "default");
    const view = render(<AnswerCard partial block={block} />);
    const firstRenders = markdown.mock.calls.length;
    const [first, ...rest] = block.keyPoints;
    const grown = { ...block, keyPoints: [`${first} More`, ...rest] };

    view.rerender(<AnswerCard partial block={grown} />);

    expect(markdown.mock.calls.length).toBe(firstRenders + 1);
  });
});

describe("@ai-sdk/react streaming contract", () => {
  // GenUIToolResult's memo relies on this: if an SDK upgrade deep-clones parts on each chunk,
  // this fails and the memo needs a content-based comparison instead.
  test("keeps a finished tool part's output reference while later text streams", async () => {
    const chunks: UIMessageChunk[] = [
      { type: "start", messageId: "a1" },
      {
        type: "tool-input-available",
        toolCallId: "t1",
        toolName: RENDER_GEN_UI_TOOL_NAME,
        input: output,
      },
      { type: "tool-output-available", toolCallId: "t1", output },
      { type: "text-start", id: "x1" },
      { type: "text-delta", id: "x1", delta: "After " },
      { type: "text-delta", id: "x1", delta: "the card." },
      { type: "text-end", id: "x1" },
      { type: "finish" },
    ];
    const chat = new Chat<UIMessage>({
      transport: {
        sendMessages: async () =>
          new ReadableStream<UIMessageChunk>({
            start(controller) {
              for (const chunk of chunks) controller.enqueue(chunk);
              controller.close();
            },
          }),
        reconnectToStream: async () => null,
      },
    });
    const outputs: unknown[] = [];
    const unsubscribe = chat["~registerMessagesCallback"](() => {
      const assistant = chat.messages.find((m) => m.role === "assistant");
      const toolPart = assistant?.parts.find(
        (p) => p.type === `tool-${RENDER_GEN_UI_TOOL_NAME}` && "output" in p && p.output
      );

      if (toolPart && "output" in toolPart) outputs.push(toolPart.output);
    });

    await chat.sendMessage({ text: "Explain heapq" });
    unsubscribe();

    const assistant = chat.messages.find((m) => m.role === "assistant");

    expect(assistant?.parts.some((p) => p.type === "text" && p.text === "After the card.")).toBe(
      true
    );
    // At least one update after the output arrived, all sharing one reference.
    expect(outputs.length).toBeGreaterThan(1);
    expect(new Set(outputs).size).toBe(1);
  });
});
