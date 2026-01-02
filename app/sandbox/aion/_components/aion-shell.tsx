"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

import { Chat } from "@/components/chat/chat";
import { ArchetypeHost } from "./archetype-host";
import { Thread } from "@/lib/schemas/chat";
import { UIMessage } from "ai";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/third-party/ui/tabs";
import { glass } from "@/components/design-system/primitives";
import { ArchetypeProvider, useArchetypeContext } from "@/lib/context/archetype-context";

type AionShellProps = {
  chatData: { thread: Thread; messages: UIMessage[] } | null;
};

export function AionShell({ chatData }: AionShellProps) {
  const [activeTab, setActiveTab] = useState<"chat" | "archetype">("chat");

  const { showArchetype, open, close, toggle, setAndOpen } = useArchetypeContext();

  return (
    <div className="w-full h-full relative overflow-hidden">
      {/* Desktop toggle, TODO: Likely temporary */}
      <button
        onClick={toggle}
        className="hidden md:block absolute top-3 right-32 z-20 rounded-md border border-border bg-background/80 px-3 py-1 text-sm hover:bg-background-secondary transition-colors"
      >
        {showArchetype ? "Hide archetype" : "Show archetype"}
      </button>

      {/* Mobile tabs */}
      {/* TODO: Hide tabs when no archetype open */}
      <div className="md:hidden w-full h-full pt-3 flex flex-col overflow-x-hidden">
        <Tabs
          value={showArchetype ? "archetype" : "chat"}
          onValueChange={(val) => val === "archetype" ? open() : close()}
          className="w-full flex-1 flex flex-col min-h-0"
        >
          <TabsList className={`${glass({ opaque: true })} z-20 w-full grid grid-cols-2 mt-2`}>
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="archetype">Archetype</TabsTrigger>
          </TabsList>
          <TabsContent forceMount value="chat" className={`data-[state=inactive]:opacity-0 transition-all duration-400 data-[state=inactive]:z-0 z-10 absolute w-full h-full mt-2 flex-1 min-h-0 overflow-hidden`}>
            <div className="w-full h-full flex items-center justify-center">
              <Chat chatData={chatData} persona="aion" endpoint="/api/ai/aion" />
            </div>
          </TabsContent>
          <TabsContent forceMount value="archetype" className={`data-[state=inactive]:opacity-0 transition-all duration-400 data-[state=inactive]:z-0 z-10 mt-2 flex-1 min-h-0 overflow-hidden`}>
            <div className="w-full h-full">
              <ArchetypeHost showGlass={false} />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Desktop layout */}
      <motion.div
        layout
        className="hidden md:flex w-full h-full flex-row items-center justify-center overflow-hidden gap-0"
        transition={{ type: "spring", stiffness: 260, damping: 32 }}
      >
        <motion.div
          layout
          className="flex-1 h-full p-4 max-w-3xl min-w-0 flex items-center justify-center"
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

      {/* Mobile layout handled by Tabs above */}
    </div>
  );
}

