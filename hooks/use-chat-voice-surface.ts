"use client";

import type { ChatStatus, UIMessage } from "ai";
import type { SpeakScreenSurface } from "@/lib/schemas/speak-screen-context";

import { useEffect, useState } from "react";

/**
 * A chat thread's screen descriptor for voice, with a `revision` that moves once per finished
 * exchange so a live call hears about the conversation as it continues, not only when it opens.
 *
 * The revision is the last message's id while `useChat` is settled, and **holds** during a turn:
 * the server builds context from the database, which only has the new messages once the stream
 * has finished (`saveChat` runs in the stream's `onFinish`, before it closes). Moving on the first
 * streamed token would push the thread without the exchange that caused the push.
 */
export function useChatVoiceSurface(
  threadId: string | null | undefined,
  messages: UIMessage[],
  status: ChatStatus
): SpeakScreenSurface | null {
  const settled = status === "ready" || status === "error";
  const lastId = messages.at(-1)?.id;
  const [revision, setRevision] = useState<string | undefined>(settled ? lastId : undefined);

  useEffect(() => {
    if (settled) setRevision(lastId);
  }, [settled, lastId]);

  return threadId ? { kind: "chat", id: threadId, revision } : null;
}
