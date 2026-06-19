"use client";

import { GenUIFallbackMarkdown } from "./GenUIFallbackMarkdown";
import { GenUIWrapper, type GenUIArtifactSource } from "./GenUIWrapper";
import { GEN_UI_REGISTRY } from "./registry";

import {
  extractGenUIBlockFromToolOutput,
  safeParseGenUIBlock,
  type GenUIBlock,
} from "@/lib/schemas/gen-ui";

type GenUIRendererProps = {
  /** Raw tool output or block object. */
  data: unknown;
  messageId?: string;
  artifactSource?: GenUIArtifactSource;
};

function renderBlock(
  block: GenUIBlock,
  partial: boolean,
  messageId?: string,
  artifactSource?: GenUIArtifactSource
) {
  const entry = GEN_UI_REGISTRY[block.type];
  const { Component } = entry;

  return (
    <GenUIWrapper artifactSource={artifactSource} block={block} partial={partial}>
      <Component block={block} partial={partial} />
    </GenUIWrapper>
  );
}

export function GenUIRenderer({ data, messageId, artifactSource }: GenUIRendererProps) {
  const raw = extractGenUIBlockFromToolOutput(data);
  const parsed = safeParseGenUIBlock(raw);

  if (parsed.ok) {
    return renderBlock(parsed.block, parsed.hadPartialFailures, messageId, artifactSource);
  }

  return <GenUIFallbackMarkdown messageId={messageId} raw={parsed.partial ?? raw} />;
}
