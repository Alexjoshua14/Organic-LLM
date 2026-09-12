"use client";

import { GenUIFallbackMarkdown } from "./GenUIFallbackMarkdown";
import { GEN_UI_REGISTRY } from "./registry";

import {
  extractGenUIBlockFromToolOutput,
  safeParseGenUIBlock,
  type GenUIBlock,
} from "@/lib/schemas/gen-ui";
import { cn } from "@/lib/utils";

type GenUIRendererProps = {
  /** Raw tool output or block object. */
  data: unknown;
  messageId?: string;
};

function renderBlock(block: GenUIBlock, partial: boolean) {
  const { Component } = GEN_UI_REGISTRY[block.type];

  return (
    <div className={cn("not-prose", partial && "opacity-95")}>
      <Component block={block} partial={partial} />
    </div>
  );
}

export function GenUIRenderer({ data, messageId }: GenUIRendererProps) {
  const raw = extractGenUIBlockFromToolOutput(data);
  const parsed = safeParseGenUIBlock(raw);

  if (parsed.ok) {
    return renderBlock(parsed.block, parsed.hadPartialFailures);
  }

  return <GenUIFallbackMarkdown messageId={messageId} raw={parsed.partial ?? raw} />;
}
