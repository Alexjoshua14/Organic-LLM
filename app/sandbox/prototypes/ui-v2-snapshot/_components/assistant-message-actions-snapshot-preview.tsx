"use client";

import { AssistantMessageActions } from "@/components/chat/assistant-message-actions";

/** Uses production assistant actions (TTS, Pin, Copy) for an accurate static snapshot. */
export function AssistantMessageActionsSnapshotPreview({ text }: { text: string }) {
  return <AssistantMessageActions showPinAndCopy text={text} />;
}
