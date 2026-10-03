import type { KanbanCommand } from "@/lib/schemas/kanban";
import type { IntrospectionGuidedState } from "@/lib/schemas/introspection";
import type { ContextBudgetEstimate } from "@/lib/chat/context-budget";
import type { PersonaReceipt } from "@/lib/personas/unified/session";

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
    /** Unified persona: the respond-or-hold receipt for the user's message. */
    "persona-receipt"?: PersonaReceipt;
    /**
     * Arcadia multitask: orchestrator thought-routing / direct-to-subagent dispatch.
     * Dashboard shell can render which thought went where.
     */
    "multitask-routing"?: import("@/lib/schemas/thought-routing").MultitaskInboundDispatch;
    /**
     * Arcadia multitask: live worker awareness (progress / milestone / completion / failure).
     */
    "multitask-worker"?: import("@/lib/schemas/subagent-runtime").WorkerAwarenessEvent;
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
