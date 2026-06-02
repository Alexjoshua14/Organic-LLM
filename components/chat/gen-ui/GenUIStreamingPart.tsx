"use client";

import { ChatThinking } from "../chat-loading";

import { GenUISkeleton } from "./GenUISkeleton";

import { peekGenUIBlockType } from "@/lib/schemas/gen-ui";

type GenUIStreamingPartProps = {
  input: unknown;
};

export function GenUIStreamingPart({ input }: GenUIStreamingPartProps) {
  // Tool input is `{ block: <GenUIBlock> }`; unwrap (tolerate the legacy bare shape too).
  const raw =
    input && typeof input === "object" && "block" in (input as Record<string, unknown>)
      ? (input as Record<string, unknown>).block
      : input;
  const type = peekGenUIBlockType(raw);
  const partialInput =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : undefined;

  if (type) {
    return <GenUISkeleton partialInput={partialInput} type={type} />;
  }

  return (
    <div className="not-prose space-y-2">
      <GenUISkeleton />
      <div className="rounded-lg border border-border/40 bg-background-tertiary/20 px-3 py-2">
        <ChatThinking text="Structuring response…" />
      </div>
    </div>
  );
}
