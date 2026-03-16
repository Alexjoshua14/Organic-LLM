"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Suspense, useState } from "react";
import { UIMessage } from "ai";

import { ArchetypeHost } from "./archetype-host";

import { Thread } from "@/lib/schemas/chat";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/third-party/ui/tabs";
import { glass } from "@/components/design-system/primitives";
import { useArchetypeContext } from "@/lib/context/archetype-context";
import { ChatPayloadT, MemoryPayloadT, NewsPayloadT } from "@/packages/organic-ui";
import { sampleMemories } from "@/test-data/sampleData";
import { AionChat } from "@/components/chat/aionChat";

type AionShellProps = {
  chatData: { thread: Thread; messages: UIMessage[] } | null;
};

export function AionShell({ chatData }: AionShellProps) {
  const [activeTab, setActiveTab] = useState<"chat" | "archetype">("chat");

  const { showArchetype, open, close, toggle, setAndOpen, archetypeData, setArchetypeData } =
    useArchetypeContext();

  const handleTestingCycleArchetypeTypes = () => {
    const archetypeTypes = ["chat", "memory", "news"];

    const sampleChatData: ChatPayloadT = {
      id: "f11aac23-ca87-4a79-a5a9-5c7115abec2b",
      kind: "chat",
    };
    const sampleMemoryData: MemoryPayloadT = {
      id: "f11aac23-ca87-4a79-a5a9-5c7115abec2b",
      kind: "memory",
      memories: sampleMemories[0].results,
    };
    const sampleNewsData: NewsPayloadT = {
      id: "f11aac23-ca87-4a79-a5a9-5c7115abec2b",
      kind: "news",
      title: "Sample News Title",
      summary: "Sample News Summary",
      content: "Sample News Content",
    };

    return () => {
      const nextArchetypeType =
        archetypeTypes[
          (archetypeTypes.indexOf(archetypeData?.kind || "chat") + 1) % archetypeTypes.length
        ];

      switch (nextArchetypeType) {
        case "chat":
          setArchetypeData(sampleChatData);
          break;
        case "memory":
          setArchetypeData(sampleMemoryData);
          break;
        case "news":
          setArchetypeData(sampleNewsData);
          break;
      }
    };
  };

  return (
    <div className="w-full h-full flex relative overflow-hidden">
      {/* Desktop toggle, TODO: Likely temporary */}
      <div className="hidden md:flex absolute top-3 right-32 z-20 gap-2">
        <button
          className="rounded-md border border-border bg-background/80 px-3 py-1 text-sm hover:bg-background-secondary transition-colors"
          onClick={handleTestingCycleArchetypeTypes()}
        >
          Cycle Archetypes
        </button>
        <button
          className="rounded-md border border-border bg-background/80 px-3 py-1 text-sm hover:bg-background-secondary transition-colors"
          onClick={toggle}
        >
          {showArchetype ? "Hide archetype" : "Show archetype"}
        </button>
      </div>

      {/* Mobile tabs */}
      {/* TODO: Hide tabs when no archetype open */}
      <Tabs
        className="md:hidden w-full flex-1 relative mt-3 pt-3 flex flex-col min-h-0 overflow-hidden"
        value={showArchetype ? "archetype" : "chat"}
        onValueChange={(val) => (val === "archetype" ? open() : close())}
      >
        <TabsList className={`${glass({ opaque: true })} z-20 w-full grid grid-cols-2 mt-2`}>
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="archetype">Archetype</TabsTrigger>
        </TabsList>
        <TabsContent
          forceMount
          className={`data-[state=inactive]:opacity-0 transition-all duration-400 data-[state=inactive]:z-0 z-10 absolute w-full h-full mt-2 flex-1 min-h-0 overflow-hidden`}
          value="chat"
        >
          <div className="w-full h-full flex items-center justify-center">
            <AionChat chatData={chatData} endpoint="/api/ai/aion" persona="aion" />
          </div>
        </TabsContent>
        <TabsContent
          forceMount
          className={`data-[state=inactive]:opacity-0 transition-all duration-400 data-[state=inactive]:z-0 z-10 mt-2 flex-1 min-h-0 overflow-hidden`}
          value="archetype"
        >
          <div className="w-full h-full">
            <ArchetypeHost showGlass={false} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Desktop layout */}
      <motion.div
        layout
        className="hidden md:flex w-full h-full flex-row overflow-hidden justify-center gap-0"
        transition={{ type: "spring", stiffness: 260, damping: 32 }}
      >
        <motion.div
          layout
          className="flex-1 h-full p-4 max-w-3xl min-w-0 flex items-center justify-center"
          transition={{ type: "spring", stiffness: 260, damping: 32 }}
        >
          <AionChat chatData={chatData} endpoint="/api/ai/aion" persona="aion" />
        </motion.div>
        <Suspense fallback={<div>Loading...</div>}>
          <AnimatePresence initial={false} mode="popLayout">
            {showArchetype ? (
              <motion.div
                key="archetype"
                layout
                animate={{ x: 0, opacity: 1 }}
                className="h-full flex-1 min-w-0 flex flex-col"
                exit={{ x: 320, opacity: 0 }}
                initial={{ x: 320, opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 32 }}
              >
                <ArchetypeHost />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </Suspense>
      </motion.div>

      {/* Mobile layout handled by Tabs above */}
    </div>
  );
}
