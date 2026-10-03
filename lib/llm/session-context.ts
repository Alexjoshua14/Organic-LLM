import "server-only";

import type { UIMessage } from "ai";

import { getConversationSummary, getNMessages } from "@/data/supabase/chat";
import { createLogger } from "@/lib/logger";
import { ARCADIA_MEMORY_MIN_SCORE, selectMemoriesForPrompt } from "@/lib/memory/memory-relevance";
import { searchMemoriesWithL1Cache } from "@/lib/memory/memory-search-cache";

const logger = createLogger("lib/llm/session-context.ts");

/** Rough heuristic: ~4 characters per token for English prose. */
const CHARS_PER_TOKEN = 4;

export function estimateSessionContextTokens(text: string): number {
  const trimmed = text.trim();

  if (!trimmed) return 0;

  return Math.ceil(trimmed.length / CHARS_PER_TOKEN);
}

export type SessionContextInput = {
  summary: string | null;
  recentTurns: Array<{ role: "user" | "assistant"; text: string }>;
  memories: string[];
};

export type SessionContextLimits = {
  maxTokens: number;
  recentTurns: number;
  turnMaxChars: number;
  summaryMaxChars: number;
  memoryLimit: number;
  memoryOverfetch: number;
};

export type LoadSessionContextDeps = {
  getConversationSummary: typeof getConversationSummary;
  getNMessages: typeof getNMessages;
  searchMemoriesWithL1Cache: typeof searchMemoriesWithL1Cache;
};

const defaultDeps: LoadSessionContextDeps = {
  getConversationSummary,
  getNMessages,
  searchMemoriesWithL1Cache,
};

function clip(text: string, max: number): string {
  const trimmed = text.trim();

  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

function textOf(message: UIMessage): string {
  return message.parts
    .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("")
    .trim();
}

/**
 * Loads a compact session preamble: rolling summary, top memories, and the last N turns.
 * Shared by Speak resume and Aion presence micro-turns.
 */
export async function loadSessionContext(
  args: {
    ownerId: string;
    threadId: string;
    memoryEnabled: boolean;
    limits: SessionContextLimits;
  },
  deps: LoadSessionContextDeps = defaultDeps
): Promise<SessionContextInput> {
  const [summaryResult, messagesResult] = await Promise.all([
    deps.getConversationSummary(args.threadId),
    deps.getNMessages(args.threadId, args.limits.recentTurns),
  ]);

  if (summaryResult.error) {
    logger.warn("loadSessionContext", `summary unavailable: ${summaryResult.error.message}`);
  }
  if (messagesResult.error) {
    logger.warn("loadSessionContext", `messages unavailable: ${messagesResult.error}`);
  }

  const summary = summaryResult.data?.trim() || null;
  const recentTurns = (messagesResult.data ?? [])
    .filter((m): m is UIMessage & { role: "user" | "assistant" } => m.role !== "system")
    .map((m) => ({ role: m.role, text: textOf(m) }))
    .filter((t) => t.text.length > 0);

  let memories: string[] = [];

  if (args.memoryEnabled) {
    const lastUserTurn = [...recentTurns].reverse().find((t) => t.role === "user")?.text ?? null;
    const seed = summary ?? lastUserTurn;

    if (seed) {
      const run = await deps.searchMemoriesWithL1Cache(
        args.ownerId,
        clip(seed, 2_000),
        args.limits.memoryOverfetch
      );

      if (run.result.error) {
        logger.warn("loadSessionContext", `memory search failed: ${run.result.error}`);
      } else {
        memories = selectMemoriesForPrompt(run.result.data?.results ?? [], {
          maxIncluded: args.limits.memoryLimit,
          minScore: ARCADIA_MEMORY_MIN_SCORE,
        }).map((m) => m.memory);
      }
    }
  }

  return { summary, recentTurns, memories };
}

function render(input: SessionContextInput, turnMaxChars: number): string {
  const sections: string[] = [];

  if (input.summary) {
    sections.push(`Conversation so far:\n${input.summary}`);
  }

  if (input.memories.length > 0) {
    sections.push(
      `Things you remember about this user:\n${input.memories.map((m) => `- ${m}`).join("\n")}`
    );
  }

  if (input.recentTurns.length > 0) {
    const lines = input.recentTurns.map(
      (t) => `${t.role === "user" ? "User" : "You"}: ${clip(t.text, turnMaxChars)}`
    );

    sections.push(`Most recent exchange:\n${lines.join("\n")}`);
  }

  return sections.join("\n\n");
}

/**
 * Renders the preamble in summary → memories → recent-turns order and trims to
 * `limits.maxTokens`: oldest turns go first, then lowest-ranked memories, then the
 * summary is clipped. Returns "" when there is nothing to say.
 */
export function formatSessionContext(
  input: SessionContextInput,
  limits: Pick<SessionContextLimits, "maxTokens" | "turnMaxChars" | "summaryMaxChars">
): string {
  const working: SessionContextInput = {
    summary: input.summary ? clip(input.summary, limits.summaryMaxChars) : null,
    recentTurns: [...input.recentTurns],
    memories: [...input.memories],
  };

  let text = render(working, limits.turnMaxChars);

  while (text && estimateSessionContextTokens(text) > limits.maxTokens) {
    if (working.recentTurns.length > 0) {
      working.recentTurns.shift();
    } else if (working.memories.length > 0) {
      working.memories.pop();
    } else if (working.summary) {
      const next = Math.floor(working.summary.length * 0.7);

      working.summary = next > 80 ? clip(working.summary, next) : null;
    } else {
      break;
    }

    text = render(working, limits.turnMaxChars);
  }

  return text;
}
