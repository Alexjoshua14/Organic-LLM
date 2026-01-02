"use client";

import { useState } from "react";

import { Chat } from "@/components/chat/chat";
import { ArchetypeHost } from "./archetype-host";
import { Thread } from "@/lib/schemas/chat";
import { UIMessage } from "ai";

type AionShellProps = {
  chatData: { thread: Thread; messages: UIMessage[] } | null;
};

export function AionShell({ chatData }: AionShellProps) {
  const [showArchetype, setShowArchetype] = useState(true);

  return (
    <div className="w-full h-full relative">
      <button
        onClick={() => setShowArchetype((prev) => !prev)}
        className="absolute top-3 right-32 z-20 rounded-md border border-border bg-background/80 px-3 py-1 text-sm hover:bg-background-secondary transition-colors"
      >
        {showArchetype ? "Hide archetype" : "Show archetype"}
      </button>

      <div className="w-full h-full flex flex-row">
        <div className="flex-1 h-full flex items-center justify-center p-4 w-sm">
          <Chat chatData={chatData} persona="aion" endpoint="/api/ai/aion" />
        </div>
        {showArchetype ? <ArchetypeHost /> : null}
      </div>
    </div>
  );
}

