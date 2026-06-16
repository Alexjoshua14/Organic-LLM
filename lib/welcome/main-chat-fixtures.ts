import type { ParsedMemorySearchToolOutput } from "@/components/chat/memory-search-tool-result";
import type { ParsedWebSearchToolOutput } from "@/components/chat/web-search-tool-result";

export const WELCOME_MAIN_CHAT_USER_PROMPT =
  "What did we land on for episodic recall—and which models offer ZDR today?";

export const WELCOME_MAIN_CHAT_ASSISTANT_REPLY =
  "From last week: episodic recall runs before each reply when memory is on, with tool traces you can inspect. For ZDR, several Claude and GPT routes in the catalog qualify—want me to filter to your default?";

export const WELCOME_MAIN_CHAT_MEMORY_RESULT: ParsedMemorySearchToolOutput = {
  status: "ok",
  query: "episodic recall tool fingerprints",
  count: 2,
  memories: [
    {
      id: "mem-1",
      memory: "Episodic recall runs before the model answers when memory is enabled.",
      score: 0.91,
    },
    {
      id: "mem-2",
      memory: "Tool fingerprints show which retrievals ran on each turn.",
      score: 0.84,
    },
  ],
};

export const WELCOME_MAIN_CHAT_SEARCH_RESULT: ParsedWebSearchToolOutput = {
  status: "success",
  rows: [
    {
      id: "zdr-1",
      title: "Zero data retention for API customers",
      url: "https://example.com/zdr-policy",
      highlightsLine: "Providers may offer ZDR for eligible API routes when configured.",
    },
    {
      id: "zdr-2",
      title: "Model catalog — retention flags",
      url: "https://example.com/model-catalog",
      highlightsLine: "Gateway models can expose a zero-data-retention indicator in-thread.",
    },
  ],
};
