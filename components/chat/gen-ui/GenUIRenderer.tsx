"use client";

import {
  extractGenUIBlockFromToolOutput,
  safeParseGenUIBlock,
  type GenUIBlock,
} from "@/lib/schemas/gen-ui";

import { GenUIFallbackMarkdown } from "./GenUIFallbackMarkdown";
import { GenUIWrapper } from "./GenUIWrapper";
import { GEN_UI_REGISTRY } from "./registry";

type GenUIRendererProps = {
  /** Raw tool output or block object. */
  data: unknown;
  messageId?: string;
};

function renderBlock(block: GenUIBlock, partial: boolean, messageId?: string) {
  const entry = GEN_UI_REGISTRY[block.type];
  const { Component } = entry;
  return (
    <GenUIWrapper block={block} partial={partial}>
      <Component block={block} partial={partial} />
    </GenUIWrapper>
  );
}

export function GenUIRenderer({ data, messageId }: GenUIRendererProps) {
  const raw = extractGenUIBlockFromToolOutput(data);
  const parsed = safeParseGenUIBlock(raw);

  if (parsed.ok) {
    return renderBlock(parsed.block, parsed.hadPartialFailures, messageId);
  }

  return <GenUIFallbackMarkdown messageId={messageId} raw={parsed.partial ?? raw} />;
}
