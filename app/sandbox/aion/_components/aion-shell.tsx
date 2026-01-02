"use client";

import { AnimatePresence, motion } from "framer-motion";
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
    <div className="w-full h-full relative overflow-hidden">
      <button
        onClick={() => setShowArchetype((prev) => !prev)}
        className="absolute top-3 right-32 z-20 rounded-md border border-border bg-background/80 px-3 py-1 text-sm hover:bg-background-secondary transition-colors"
      >
        {showArchetype ? "Hide archetype" : "Show archetype"}
      </button>

      <motion.div
        layout
        className="w-full h-full flex flex-row items-center justify-center overflow-hidden gap-0"
        transition={{ type: "spring", stiffness: 260, damping: 32 }}
      >
        <motion.div
          layout
          className="flex-1 h-full p-4 max-w-4xl min-w-0 flex items-center justify-center"
          transition={{ type: "spring", stiffness: 260, damping: 32 }}
        >
          <Chat chatData={chatData} persona="aion" endpoint="/api/ai/aion" />
        </motion.div>
        <AnimatePresence initial={false} mode="popLayout">
          {showArchetype ? (
            <motion.div
              key="archetype"
              layout
              initial={{ x: 320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 320, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 32 }}
              className="h-full shrink-0"
            >
              <ArchetypeHost />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

