import "server-only";

import type { UIMessage } from "ai";
import type { SpeakContext } from "@/lib/speak/types";

import { after } from "next/server";

import { getConversationSummary, getNMessages } from "@/data/supabase/chat";
import { generateLensOverviewTextCached } from "@/lib/memory/lens-overview-llm";
import { formatMemoriesForPrompt } from "@/lib/memory/memory-relevance";
import { searchMemoriesForUser } from "@/lib/memory/operations";
import { createLogger } from "@/lib/logger";
import { describeElapsedSinceTimestamp } from "@/lib/speak/elapsed";

const logger = createLogger("lib/speak/build-speak-context.ts");

/** Broad identity query — there is no user message yet at session mint. */
const SEED_QUERY =
  "Who is this user? Their identity, goals, preferences, projects, and important ongoing context.";
const MEMORY_LIMIT = 10;
const RECENT_TURNS = 6;
const RECENT_TURN_CHAR_CAP = 400;
/** Include the cached user overview only if it's warm enough to be instant. */
const OVERVIEW_CACHE_TIMEOUT_MS = 250;

export type BuildSpeakContextArgs = {
  userId: string;
  threadId: string | null;
  /** Resumed thread's `updated_at` (ISO); null for a brand-new thread. */
  updatedAt: string | null;
};

/**
 * Assembles the Realtime agent's priming context from existing memory + thread
 * pieces. Fast by design: memory search + summary + recent turns run in
 * parallel, and the LLM user-overview is included only on a cache hit (never
 * blocks session mint — see {@link OVERVIEW_CACHE_TIMEOUT_MS}).
 */
export async function buildSpeakContext(args: BuildSpeakContextArgs): Promise<SpeakContext> {
  const { userId, threadId, updatedAt } = args;

  const [memRes, recapRes, msgsRes] = await Promise.all([
    searchMemoriesForUser(userId, SEED_QUERY, { limit: MEMORY_LIMIT }),
    threadId
      ? getConversationSummary(threadId)
      : Promise.resolve({ data: null, error: null } as const),
    threadId
      ? getNMessages(threadId, RECENT_TURNS)
      : Promise.resolve({ data: [] as UIMessage[], error: null } as const),
  ]);

  const memories = memRes.error || !memRes.data ? [] : memRes.data.results;
  const memoryDump = memories.length > 0 ? formatMemoriesForPrompt(memories) : null;

  const overview = memoryDump ? await readFreshOverview(userId, memoryDump) : null;

  const recap = recapRes.error ? null : recapRes.data?.trim() || null;
  const recentTurns = renderRecentTurns(msgsRes.error || !msgsRes.data ? [] : msgsRes.data);
  const elapsedPhrase = describeElapsedSinceTimestamp(updatedAt);

  return {
    memoryDump,
    overview,
    recap,
    recentTurns,
    elapsedPhrase,
    resumed: Boolean(updatedAt),
  };
}

/**
 * Returns the cached overview only when it resolves within the timeout (a cache
 * hit). On a miss/slow generation, returns null and lets the in-flight
 * generation finish in the background so the cache is warm next time.
 */
async function readFreshOverview(userId: string, memoryBlob: string): Promise<string | null> {
  const gen = generateLensOverviewTextCached(userId, memoryBlob)
    .then((text) => text.trim() || null)
    .catch((err) => {
      logger.warn("readFreshOverview", `overview generation failed: ${String(err)}`);

      return null;
    });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), OVERVIEW_CACHE_TIMEOUT_MS);
  });

  const winner = await Promise.race([gen, timeout]);

  if (timer) clearTimeout(timer);

  if (winner === TIMED_OUT) {
    // Cache miss/slow: keep the generation alive so the cache warms for later.
    after(async () => {
      await gen;
    });

    return null;
  }

  return winner;
}

const TIMED_OUT = Symbol("overview-timeout");

function renderRecentTurns(messages: UIMessage[]): string | null {
  const lines = messages
    .map((message) => {
      if (message.role !== "user" && message.role !== "assistant") return null;

      const text = message.parts
        .filter((part) => part.type === "text")
        .reduce((acc, part) => acc + (part as { text: string }).text, "")
        .trim();

      if (!text) return null;

      const clipped =
        text.length > RECENT_TURN_CHAR_CAP ? `${text.slice(0, RECENT_TURN_CHAR_CAP)}…` : text;
      const who = message.role === "user" ? "User" : "You";

      return `${who}: ${clipped}`;
    })
    .filter((line): line is string => line !== null);

  return lines.length > 0 ? lines.join("\n") : null;
}
