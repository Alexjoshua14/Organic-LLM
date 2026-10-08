import "server-only";

import type { ResurfaceCardRecord } from "@/lib/resurface/cache";
import type { ResurfaceVoiceSeed } from "@/lib/resurface/voice-context";

import { searchMemoriesForUser } from "@/lib/memory/operations";

/** Memories folded into a resurfaced call's opening context. */
export const RESURFACE_VOICE_MEMORY_LIMIT = 4;

const MEMORY_QUERY_MAX_CHARS = 500;

/**
 * Builds the voice seed for a cached card. The card already carries its source and related items;
 * memory is searched only when the session opted in, mirroring chat's composer toggle. A failed
 * search seeds without memories rather than failing the call.
 */
export async function loadResurfaceVoiceSeed(
  args: { ownerId: string; card: ResurfaceCardRecord; memoryEnabled: boolean },
  deps: { searchMemories?: typeof searchMemoriesForUser } = {}
): Promise<ResurfaceVoiceSeed> {
  const { ownerId, card, memoryEnabled } = args;
  const search = deps.searchMemories ?? searchMemoriesForUser;
  let memories: string[] = [];

  if (memoryEnabled) {
    const query = `${card.title}. ${card.recap}`.slice(0, MEMORY_QUERY_MAX_CHARS);
    const res = await search(ownerId, query, { limit: RESURFACE_VOICE_MEMORY_LIMIT }).catch(
      () => null
    );

    memories = (res?.data?.results ?? [])
      .map((m) => m.memory.trim())
      .filter((m) => m && m !== card.sourceText)
      .slice(0, RESURFACE_VOICE_MEMORY_LIMIT);
  }

  return {
    kind: card.kind,
    title: card.title,
    recap: card.recap,
    sourceText: card.sourceText,
    related: card.related,
    memories,
  };
}
