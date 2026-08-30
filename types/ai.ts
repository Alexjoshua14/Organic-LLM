import type { KanbanCommand } from "@/lib/schemas/kanban";
import type { ServerErrorBody } from "@/lib/observability/server-error";
import type { IntrospectionGuidedState } from "@/lib/schemas/introspection";
import type { ContextBudgetEstimate } from "@/lib/chat/context-budget";

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
    /** Introspection guided shell: stable overview + navigation state. */
    "introspection-view"?: IntrospectionGuidedState;
    /** Server-measured context budget for the assembled turn. */
    "context-budget"?: ContextBudgetEstimate;
    /**
     * Structured failure raised after the response headers were already sent, so the
     * client can show the stage + error id instead of a bare "An error occurred".
     * `detail` is populated for admins only.
     */
    error?: ServerErrorBody;
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
