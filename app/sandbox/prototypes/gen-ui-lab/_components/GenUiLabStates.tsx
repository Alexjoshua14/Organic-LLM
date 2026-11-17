"use client";

import { useState } from "react";

import { GenUIFallbackMarkdown } from "@/components/chat/gen-ui/GenUIFallbackMarkdown";
import { GenUIRenderer } from "@/components/chat/gen-ui/GenUIRenderer";
import { GenUISkeleton } from "@/components/chat/gen-ui/GenUISkeleton";
import {
  FIXTURE_DECISION_MATRIX_PARTIAL,
  FIXTURE_INVALID_BLOCK,
  FIXTURE_STREAMING_STAGES,
} from "@/lib/schemas/gen-ui/fixtures";

/** Non-happy-path renders the lab shows beside the archetypes. */
export const GEN_UI_LAB_STATES = [
  {
    id: "partial",
    label: "Partial recovery",
    hint: "A malformed field is dropped and the rest of the block still renders.",
  },
  {
    id: "invalid",
    label: "Invalid → markdown",
    hint: "A block that fails validation falls back to readable markdown.",
  },
  {
    id: "streaming",
    label: "Streaming skeleton",
    hint: "The skeleton the chat shows while a block is still arriving, stage by stage.",
  },
] as const;

export type GenUiLabStateId = (typeof GEN_UI_LAB_STATES)[number]["id"];

function StreamingStages() {
  const [index, setIndex] = useState(0);
  const input = FIXTURE_STREAMING_STAGES[index] ?? FIXTURE_STREAMING_STAGES[0]!;
  const last = FIXTURE_STREAMING_STAGES.length - 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-50"
          disabled={index <= 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
        >
          Prev stage
        </button>
        <button
          type="button"
          className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-50"
          disabled={index >= last}
          onClick={() => setIndex((i) => Math.min(last, i + 1))}
        >
          Next stage
        </button>
        <span className="text-xs text-muted-foreground">
          Stage {index + 1} / {last + 1}
        </span>
      </div>
      <GenUISkeleton
        partialInput={input as Record<string, unknown>}
        type={typeof input.type === "string" ? (input.type as "answer-card") : undefined}
      />
    </div>
  );
}

export function GenUiLabStatePanel({ state }: { state: GenUiLabStateId }) {
  switch (state) {
    case "partial":
      return (
        <GenUIRenderer
          data={{ block: FIXTURE_DECISION_MATRIX_PARTIAL }}
          messageId="lab-state-partial"
        />
      );
    case "invalid":
      return <GenUIFallbackMarkdown messageId="lab-state-invalid" raw={FIXTURE_INVALID_BLOCK} />;
    case "streaming":
      return <StreamingStages />;
  }
}
