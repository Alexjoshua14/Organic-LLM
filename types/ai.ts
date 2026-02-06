import { ExaSearchResultSource } from "@/lib/exa/types";
import { UIMessage } from "ai";
import { ContentsOptions, SearchResult } from "exa-js";

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
