"use client";

import { memo } from "react";

import { GenUIRenderer } from "./GenUIRenderer";

type GenUIToolResultProps = {
  output: unknown;
  messageId: string;
  partIndex: number;
};

/**
 * Memoized on `output` identity. While a message streams, `useChat` re-renders it on every chunk,
 * but the SDK only shallow-copies parts (`{ ...part }`), so a finished part keeps its `output`
 * object and the card skips re-validating and re-parsing its markdown as text streams after it.
 */
export const GenUIToolResult = memo(function GenUIToolResult({
  output,
  messageId,
  partIndex,
}: GenUIToolResultProps) {
  return <GenUIRenderer data={output} messageId={`${messageId}-gen-ui-${partIndex}`} />;
});
