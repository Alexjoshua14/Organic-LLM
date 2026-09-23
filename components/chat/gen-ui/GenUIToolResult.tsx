"use client";

import { GenUIRenderer } from "./GenUIRenderer";

type GenUIToolResultProps = {
  output: unknown;
  messageId: string;
  partIndex: number;
};

export function GenUIToolResult({ output, messageId, partIndex }: GenUIToolResultProps) {
  return <GenUIRenderer data={output} messageId={`${messageId}-gen-ui-${partIndex}`} />;
}
