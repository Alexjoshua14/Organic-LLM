"use client";

import type { AionEvent } from "@/lib/schemas/aion-presence";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Suspense } from "react";
import { UIMessage } from "ai";

import { AionEventBench } from "./aion-event-bench";
import { AionPresenceHud } from "./aion-presence-hud";
import { useAionPresence } from "./aion-presence-provider";
import { ArchetypeHost } from "./archetype-host";

import { AdaptiveOrganicPresence } from "@/components/ambient/AdaptiveOrganicPresence";
import { AionChat } from "@/components/chat/aionChat";
import { glass } from "@/components/design-system/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/third-party/ui/tabs";
import { useAionPresenceStore } from "@/lib/aion/presence/event-bus";
import { useArchetypeContext } from "@/lib/context/archetype-context";
import { Thread } from "@/lib/schemas/chat";
import { ChatPayloadT, MemoryPayloadT, NewsPayloadT } from "@/packages/organic-ui";
import { sampleMemories } from "@/test-data/sampleData";

type AionShellProps = {
  chatData: { thread: Thread; messages: UIMessage[] } | null;
};

export function AionShell({ chatData }: AionShellProps) {
  const reduceMotion = useReducedMotion();
  const phase = useAionPresenceStore((s) => s.phase);
  const lastReply = useAionPresenceStore((s) => s.lastTurn);
  const { registerChatSend } = useAionPresence();

  const { showArchetype, open, close, toggle, archetypeData, setArchetypeData } =
    useArchetypeContext();

  const presenceState = reduceMotion
    ? "idle"
    : phase === "thinking"
      ? "thinking"
      : phase === "responding"
        ? "responding"
        : phase === "active"
          ? "active"
          : "idle";

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
      <AdaptiveOrganicPresence position="bottom-left" size={90} state={presenceState} />

      <AionPresenceHud />

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
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 px-2 pb-28">
            <AionEventBench className="w-full max-w-232 shrink-0" />
            {lastReply?.text && !lastReply.silent ? (
              <PresenceCaption text={lastReply.text} />
            ) : null}
            <div className="w-full flex-1 min-h-0">
              <AionChatBridge chatData={chatData} registerChatSend={registerChatSend} />
            </div>
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

      <motion.div
        layout
        className="hidden md:flex w-full h-full flex-row overflow-hidden justify-center gap-0"
        transition={{ type: "spring", stiffness: 260, damping: 32 }}
      >
        <motion.div
          layout
          className="flex-1 h-full p-4 max-w-3xl min-w-0 flex flex-col items-center justify-center gap-3"
          transition={{ type: "spring", stiffness: 260, damping: 32 }}
        >
          <AionEventBench className="w-full shrink-0" />
          {lastReply?.text && !lastReply.silent ? <PresenceCaption text={lastReply.text} /> : null}
          <div className="w-full flex-1 min-h-0">
            <AionChatBridge chatData={chatData} registerChatSend={registerChatSend} />
          </div>
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
    </div>
  );
}

function PresenceCaption({ text }: { text: string }) {
  return (
    <div
      className={`${glass({ opaque: true })} w-full max-w-232 rounded-lg border border-border/50 px-3 py-2 text-sm`}
      role="status"
    >
      {text}
    </div>
  );
}

function AionChatBridge({
  chatData,
  registerChatSend,
}: {
  chatData: { thread: Thread; messages: UIMessage[] } | null;
  registerChatSend: (send: ((text: string, trigger?: AionEvent) => void) | null) => void;
}) {
  return (
    <AionChat
      chatData={chatData}
      endpoint="/api/ai/aion"
      persona="aion"
      onRegisterSend={registerChatSend}
    />
  );
}
