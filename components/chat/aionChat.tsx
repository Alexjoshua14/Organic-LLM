"use client";

import { useMemo } from "react";
import { z } from "zod";

import { Chat, type ChatProps } from "./chat";

import { MemoryItem } from "@/lib/schemas/memory";
import { clientRandomUUID } from "@/lib/client-uuid";
import { useArchetypeContext } from "@/lib/context/archetype-context";

export type AionChatProps = Omit<ChatProps, "clientTools">;

/** A thin surface adapter: full turns keep pace with Arcadia instead of forking its UI. */
export function AionChat(props: AionChatProps) {
  const { open, close, setAndOpen, archetypeData, showArchetype } = useArchetypeContext();
  const clientTools = useMemo(
    () => ({
      set_state_archetype: (input: unknown) => {
        const { open: shouldOpen } = z.object({ open: z.boolean() }).parse(input);

        if (shouldOpen) open();
        else close();

        return { state: shouldOpen };
      },
      show_memories: (input: unknown) => {
        const { memories } = z.object({ memories: z.array(MemoryItem) }).parse(input);

        setAndOpen({ id: clientRandomUUID(), kind: "memory", memories });

        return { count: memories.length, state: true };
      },
      view_archetype: () => ({ archetype: archetypeData, state: showArchetype }),
    }),
    [open, close, setAndOpen, archetypeData, showArchetype]
  );

  return <Chat {...props} clientTools={clientTools} experience="aion" persona="aion" />;
}
