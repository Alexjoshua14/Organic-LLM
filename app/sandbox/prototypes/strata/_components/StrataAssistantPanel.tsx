"use client";

import type { UIMessage } from "ai";

import { Chat } from "@/components/chat/chat";
import type { Thread } from "@/lib/schemas/chat";

export function StrataAssistantPanel({
  chatData,
  experience,
  strataPageId,
  emptyHint,
}: {
  chatData: { thread: Thread; messages: UIMessage[] } | null;
  experience: string;
  strataPageId?: string;
  emptyHint?: string;
}) {
  if (!chatData) {
    return (
      <div className="flex h-full min-h-[12rem] items-center justify-center p-6 text-center text-sm text-muted-foreground">
        {emptyHint ??
          "Assistant is not available in this mode. Sign in with Supabase connected to use chat here."}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Chat chatData={chatData} experience={experience} persona="strata" strataPageId={strataPageId} />
    </div>
  );
}
