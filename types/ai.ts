import type { KanbanCommand } from "@/lib/schemas/kanban";

import { UIMessage } from "ai";

import { ExaSearchResultSource } from "@/lib/exa/types";

// Define your custom message type with data part schemas
export type MyUIMessage = UIMessage<
  never, // metadata type
  {
    notification: {
      message: string;
      level: "info" | "warning" | "error";
    };
  } // data parts type
>;

export type ChatUIMessage = UIMessage<
  never,
  {
    notification?: {
      message: string;
      level: "info" | "warning" | "error";
    };
    aiAction?: {
      action: ChatAIActionEnum;
      message?: string;
      sources?: ExaSearchResultSource[];
    };
    /** Ergon puppet channel: schema-validated kanban command streamed to the client store. */
    kanban?: KanbanCommand;
  }
>;

export enum ChatAIActionEnum {
  Processing = "processing",
  Search = "search",
  Memory = "memory",
  Tool = "tool",
  Reasoning = "reasoning",
  Typing = "typing",
  Errored = "errored",
}
