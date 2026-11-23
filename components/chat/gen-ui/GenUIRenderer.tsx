"use client";

import { useMemo } from "react";

import { CompositionView, type CompositionDensity } from "./CompositionView";
import { GenUIFallbackMarkdown } from "./GenUIFallbackMarkdown";
import { GEN_UI_REGISTRY } from "./registry";

import {
  extractGenUIBlockFromToolOutput,
  safeParseGenUIChatBlock,
  type GenUIBlock,
} from "@/lib/schemas/gen-ui";
import { cn } from "@/lib/utils";

type GenUIRendererProps = {
  /** Raw tool output or block object. */
  data: unknown;
  messageId?: string;
  compositionDensity?: CompositionDensity;
};

function renderBlock(block: GenUIBlock, partial: boolean) {
  const { Component } = GEN_UI_REGISTRY[block.type];

  return (
    <div className={cn("not-prose", partial && "opacity-95")}>
      <Component block={block} partial={partial} />
    </div>
  );
}

export function GenUIRenderer({ data, messageId, compositionDensity }: GenUIRendererProps) {
  // Schema validation walks the whole block; redo it only when the tool output changes.
  const { raw, parsed } = useMemo(() => {
    const raw = extractGenUIBlockFromToolOutput(data);

    return { raw, parsed: safeParseGenUIChatBlock(raw) };
  }, [data]);

  if (parsed.ok) {
    if (parsed.block.type === "composition") {
      return (
        <div className="not-prose">
          <CompositionView block={parsed.block} density={compositionDensity} />
        </div>
      );
    }

    return renderBlock(parsed.block, parsed.hadPartialFailures);
  }

  return <GenUIFallbackMarkdown messageId={messageId} raw={parsed.partial ?? raw} />;
}
