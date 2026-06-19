"use client";

import { GenUIRenderer } from "./GenUIRenderer";
import type { GenUIArtifactSource } from "./GenUIWrapper";

type GenUIToolResultProps = {
  output: unknown;
  messageId: string;
  partIndex: number;
  artifactSource?: GenUIArtifactSource;
};

export function GenUIToolResult({
  output,
  messageId,
  partIndex,
  artifactSource,
}: GenUIToolResultProps) {
  return (
    <GenUIRenderer
      artifactSource={artifactSource}
      data={output}
      messageId={`${messageId}-gen-ui-${partIndex}`}
    />
  );
}
