"use client";

import { ChatThinking } from "@/components/chat/chat-loading";

export function WineLineListStatus() {
  return (
    <div className="rounded-lg p-4 mb-4 text-foreground">
      <ChatThinking text="Heard you, generating..." />
    </div>
  );
}
