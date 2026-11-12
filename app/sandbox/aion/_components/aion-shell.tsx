"use client";

import type { UIMessage } from "ai";
import type { CoreInputInitialSettings } from "@/lib/core-input/settings-cookie";
import type { Thread } from "@/lib/schemas/chat";

import { useState } from "react";
import { useReducedMotion } from "framer-motion";

import { AionEventBench } from "./aion-event-bench";
import { AionPresenceHud } from "./aion-presence-hud";
import { useAionPresence } from "./aion-presence-provider";
import { ArchetypeHost } from "./archetype-host";

import { AdaptiveOrganicPresence } from "@/components/ambient/AdaptiveOrganicPresence";
import { AionChat } from "@/components/chat/aionChat";
import { Button } from "@/components/third-party/ui/button";
import { useArcadiaMultitask } from "@/app/sandbox/arcadia/_components/multitask-provider";
import { setAionPresenceEnabled, useAionPresenceStore } from "@/lib/aion/presence/event-bus";
import { useArchetypeContext } from "@/lib/context/archetype-context";
import { cn } from "@/lib/utils";

type AionShellProps = {
  chatData: { thread: Thread; messages: UIMessage[] };
  initialComposerSettings?: CoreInputInitialSettings | null;
};

export function AionShell({ chatData, initialComposerSettings }: AionShellProps) {
  const reduceMotion = useReducedMotion();
  const [benchOpen, setBenchOpen] = useState(false);
  const phase = useAionPresenceStore((s) => s.phase);
  const enabled = useAionPresenceStore((s) => s.enabled);
  const lastReply = useAionPresenceStore((s) => s.lastTurn);
  const { registerChatSend, reportChatStatus } = useAionPresence();
  const { showArchetype, toggle, close } = useArchetypeContext();
  const { layoutMode } = useArcadiaMultitask();
  const dashboard = layoutMode === "dashboard";

  return (
    <section
      className="relative flex h-full min-h-0 w-full flex-col overflow-hidden"
      aria-label="Aion presence sandbox"
    >
      <AdaptiveOrganicPresence
        position="bottom-left"
        size={90}
        state={reduceMotion ? "idle" : phase}
      />
      <header className="flex flex-wrap items-center gap-inline-sm border-b border-border/40 px-inset-md py-inset-sm md:pr-36">
        <div className="mr-auto">
          <h1 className="text-sm font-medium">
            Aion <span className="font-normal text-muted-foreground">/ Presence lab</span>
          </h1>
          <p className="text-xs text-muted-foreground">
            One intelligence. Conversation, context, and surfaces.
          </p>
        </div>
        <Button
          aria-pressed={enabled}
          size="sm"
          variant="ghost"
          onClick={() => setAionPresenceEnabled(!enabled)}
        >
          {enabled ? "Awareness on" : "Awareness paused"}
        </Button>
        <Button
          aria-controls="aion-event-bench"
          aria-expanded={benchOpen}
          size="sm"
          variant="ghost"
          onClick={() => setBenchOpen(!benchOpen)}
        >
          Event bench
        </Button>
        <Button aria-pressed={showArchetype} size="sm" variant="ghost" onClick={toggle}>
          {showArchetype ? "Conversation" : "Surface"}
        </Button>
      </header>
      {benchOpen ? (
        <div id="aion-event-bench" className="max-h-[30vh] shrink-0 overflow-y-auto p-inset-sm">
          <AionEventBench />
        </div>
      ) : null}
      {lastReply?.text && !lastReply.silent ? (
        <p className="px-inset-md py-inset-sm text-sm text-muted-foreground" role="status">
          {lastReply.text}
        </p>
      ) : null}
      <div className="relative flex min-h-0 flex-1">
        {/* Exactly one chat stays mounted through viewport, surface and multiagent changes. */}
        <div
          className={cn("h-full min-w-0 flex-1", showArchetype && !dashboard && "hidden md:block")}
        >
          <AionChat
            chatData={chatData}
            initialComposerSettings={initialComposerSettings}
            onRegisterSend={registerChatSend}
            onStatusChange={reportChatStatus}
          />
        </div>
        {showArchetype && !dashboard ? (
          <div className="absolute inset-0 z-10 min-w-0 bg-background md:static md:w-[38%] md:max-w-lg md:bg-transparent">
            <Button
              className="absolute right-3 top-2 z-10"
              size="sm"
              variant="ghost"
              onClick={close}
            >
              Close surface
            </Button>
            <ArchetypeHost className="min-w-0 max-w-none" />
          </div>
        ) : null}
      </div>
      <AionPresenceHud />
    </section>
  );
}
