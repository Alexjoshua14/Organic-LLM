export function spatialArtifactId(input: {
  threadId: string;
  toolCallId?: string;
  messageId: string;
  partIndex: number;
}): string {
  if (input.toolCallId && input.toolCallId.trim() !== "") {
    return `${input.threadId}:${input.toolCallId}`;
  }

  return `${input.threadId}:${input.messageId}:${input.partIndex}`;
}
