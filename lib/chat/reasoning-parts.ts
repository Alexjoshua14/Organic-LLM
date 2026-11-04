import type { UIMessage } from "ai";

type MessageParts = UIMessage["parts"];

/** One disclosure's worth of reasoning: a run of consecutive reasoning parts. */
export type ReasoningRun = {
  /** Non-empty part texts joined by blank lines; empty when the provider sent none. */
  text: string;
  isStreaming: boolean;
};

export type ReasoningRuns = {
  /** Keyed by the index of the run's first part; later parts of a run have no entry. */
  runsByStartIndex: Map<number, ReasoningRun>;
};

/**
 * Groups consecutive reasoning parts so one step's reasoning renders as one disclosure.
 * OpenAI emits a part per summary item; tool calls and text between steps split runs.
 */
export function groupReasoningParts(parts: MessageParts): ReasoningRuns {
  const runsByStartIndex = new Map<number, ReasoningRun>();

  let runStart = -1;
  let texts: string[] = [];
  let isStreaming = false;

  const closeRun = () => {
    if (runStart < 0) return;
    runsByStartIndex.set(runStart, { text: texts.join("\n\n"), isStreaming });
    runStart = -1;
    texts = [];
    isStreaming = false;
  };

  parts.forEach((part, i) => {
    if (part.type !== "reasoning") {
      closeRun();

      return;
    }

    if (runStart < 0) runStart = i;

    const text = part.text.trim();

    if (text) texts.push(text);
    if (part.state === "streaming") isStreaming = true;
  });
  closeRun();

  return { runsByStartIndex };
}
