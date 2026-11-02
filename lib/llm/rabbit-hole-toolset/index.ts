import type { ToolSet } from "ai";
import type { RabbitHoleToolsetDeps } from "./deps";
import type { RabbitHoleToolCategory } from "./instructions";
import type { RabbitHoleStreamWriter } from "@/lib/llm/rabbit-hole-assistant-tools";

import { createRabbitHoleCreateTools } from "./create-tools";
import { defaultRabbitHoleToolsetDeps } from "./default-deps";
import { rabbitHoleToolsetInstructions } from "./instructions";
import { createRabbitHoleReadTools } from "./read-tools";

export type { RabbitHoleToolCategory } from "./instructions";

export type CreateRabbitHoleToolsetOptions = {
  sbUserId: string;
  /** Which categories to hand this caller. Defaults to both. */
  categories?: readonly RabbitHoleToolCategory[];
  /** Rabbit hole drawer only; see `createRabbitHoleCreateTools`. */
  writer?: RabbitHoleStreamWriter;
  currentSessionId?: string;
  getDefaultParentNodeId?: (sessionId: string) => string | null;
  deps?: RabbitHoleToolsetDeps;
};

/**
 * The rabbit hole toolset: read tools (browse, search, fetch a session, node or section at a
 * chosen level of detail) and create tools (start a session, add a node). Callers take whichever
 * categories they need; Arcadia and the rabbit hole agent take both.
 */
export function createRabbitHoleToolset({
  sbUserId,
  categories = ["read", "create"],
  writer,
  currentSessionId,
  getDefaultParentNodeId,
  deps = defaultRabbitHoleToolsetDeps,
}: CreateRabbitHoleToolsetOptions): { tools: ToolSet; instructions: string } {
  const tools: ToolSet = {};

  if (categories.includes("read")) {
    Object.assign(tools, createRabbitHoleReadTools({ sbUserId, deps }));
  }

  if (categories.includes("create")) {
    Object.assign(
      tools,
      createRabbitHoleCreateTools({
        sbUserId,
        deps,
        writer,
        currentSessionId,
        getDefaultParentNodeId,
      })
    );
  }

  return { tools, instructions: rabbitHoleToolsetInstructions(categories) };
}
