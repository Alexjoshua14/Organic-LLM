import "server-only";

import type { UIMessage } from "ai";

import { getConversationSummary, getNMessages } from "@/data/supabase/chat";
import { createLogger } from "@/lib/logger";
import { ARCADIA_MEMORY_MIN_SCORE, selectMemoriesForPrompt } from "@/lib/memory/memory-relevance";
import { searchMemoriesWithL1Cache } from "@/lib/memory/memory-search-cache";
import { estimateSpeakTokens } from "@/lib/speak/token-limit";

const logger = createLogger("lib/speak/speak-session-context.ts");

/**
 * Preamble budget for a resumed session. Sessions are capped at minutes, not hours, and the
 * instructions are re-read on every model turn, so the preamble is kept to roughly one page.
 * The Realtime session also runs `retention_ratio` truncation so instructions are never evicted;
 * see the session route.
 */
export const SPEAK_CONTEXT_MAX_TOKENS = 1_800;

/** Last two exchanges verbatim; older turns are represented by the summary. */
export const SPEAK_CONTEXT_RECENT_TURNS = 4;

/** Per-turn cap so one long monologue cannot spend the whole budget. */
export const SPEAK_CONTEXT_TURN_MAX_CHARS = 400;

export const SPEAK_CONTEXT_SUMMARY_MAX_CHARS = 1_600;

export const SPEAK_CONTEXT_MEMORY_LIMIT = 5;

/** Wide Mem0 fetch, then `selectMemoriesForPrompt` keeps the top scorers. */
export const SPEAK_CONTEXT_MEMORY_OVERFETCH = 12;

export type SpeakSessionContextInput = {
  summary: string | null;
  recentTurns: Array<{ role: "user" | "assistant"; text: string }>;
  memories: string[];
};

export type LoadSpeakSessionContextDeps = {
  getConversationSummary: typeof getConversationSummary;
  getNMessages: typeof getNMessages;
  searchMemoriesWithL1Cache: typeof searchMemoriesWithL1Cache;
};

const defaultDeps: LoadSpeakSessionContextDeps = {
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

/** Recent turns and the summary only; memory needs a seed query, which they also provide. */
export async function loadSpeakSessionContext(
  args: { ownerId: string; threadId: string; memoryEnabled: boolean },
  deps: LoadSpeakSessionContextDeps = defaultDeps
): Promise<SpeakSessionContextInput> {
  const [summaryResult, messagesResult] = await Promise.all([
    deps.getConversationSummary(args.threadId),
    deps.getNMessages(args.threadId, SPEAK_CONTEXT_RECENT_TURNS),
  ]);

  if (summaryResult.error) {
    logger.warn("loadSpeakSessionContext", `summary unavailable: ${summaryResult.error.message}`);
  }
  if (messagesResult.error) {
    logger.warn("loadSpeakSessionContext", `messages unavailable: ${messagesResult.error}`);
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
        SPEAK_CONTEXT_MEMORY_OVERFETCH
      );

      if (run.result.error) {
        logger.warn("loadSpeakSessionContext", `memory search failed: ${run.result.error}`);
      } else {
        memories = selectMemoriesForPrompt(run.result.data?.results ?? [], {
          maxIncluded: SPEAK_CONTEXT_MEMORY_LIMIT,
          minScore: ARCADIA_MEMORY_MIN_SCORE,
        }).map((m) => m.memory);
      }
    }
  }

  return { summary, recentTurns, memories };
}

function render(input: SpeakSessionContextInput): string {
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
      (t) => `${t.role === "user" ? "User" : "You"}: ${clip(t.text, SPEAK_CONTEXT_TURN_MAX_CHARS)}`
    );

    sections.push(`Most recent exchange:\n${lines.join("\n")}`);
  }

  return sections.join("\n\n");
}

/**
 * Renders the preamble in the order `docs/architecture/updated-context-structure.md` uses for
 * chat — summary, memories, then the freshest turns nearest the live conversation — and trims
 * to {@link SPEAK_CONTEXT_MAX_TOKENS}: oldest turns go first, then lowest-ranked memories, then
 * the summary is clipped. Returns "" when there is nothing to say.
 */
export function formatSpeakSessionContext(
  input: SpeakSessionContextInput,
  maxTokens: number = SPEAK_CONTEXT_MAX_TOKENS
): string {
  const working: SpeakSessionContextInput = {
    summary: input.summary ? clip(input.summary, SPEAK_CONTEXT_SUMMARY_MAX_CHARS) : null,
    recentTurns: [...input.recentTurns],
    memories: [...input.memories],
  };

  let text = render(working);

  while (text && estimateSpeakTokens(text) > maxTokens) {
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

    text = render(working);
  }

  return text;
}
