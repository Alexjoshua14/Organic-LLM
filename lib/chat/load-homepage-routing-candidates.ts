import { auth } from "@clerk/nextjs/server";

import { getChats } from "@/lib/chat/chat-store";
import {
  type HomepageRouteCandidate,
  type ThreadListRow,
  buildHomepageRoutingCandidatesFromParts,
} from "@/lib/chat/thread-routing-candidates";
import { getConversationSummary } from "@/data/supabase/chat";
import { getAllSessions } from "@/data/supabase/rabbitholes";
import { getSupabaseUserId } from "@/data/supabase/profiles";
import { listStrataPagesWithRoutingExcerpts, type StrataRoutingRow } from "@/data/supabase/strata";
import { createLogger } from "@/lib/logger";
import { Result } from "@/types";

const logger = createLogger("lib/chat/load-homepage-routing-candidates.ts");

const MAX_THREAD_FETCH = 40;

/** Strata routing rows: capped and sorted by `updated_at` in {@link listStrataPagesWithRoutingExcerpts}. */

/**
 * Loads thread rows with summaries plus optional rabbit-hole sessions when coalescence is on.
 * Optional dependency overrides are for unit tests only.
 */
export async function loadHomepageRoutingCandidates(
  coalescenceMode: boolean,
  deps?: {
    getChatsImpl?: typeof getChats;
    getConversationSummaryImpl?: typeof getConversationSummary;
    getAllSessionsImpl?: typeof getAllSessions;
  }
): Promise<Result<HomepageRouteCandidate[]>> {
  const getChatsFn = deps?.getChatsImpl ?? getChats;
  const getSummaryFn = deps?.getConversationSummaryImpl ?? getConversationSummary;
  const getSessionsFn = deps?.getAllSessionsImpl ?? getAllSessions;

  const threadsRes = await getChatsFn();

  if (threadsRes.error || !threadsRes.data) {
    return {
      data: null,
      error: threadsRes.error ?? new Error("Failed to load chats"),
    };
  }

  const rows = (threadsRes.data as ThreadListRow[]).slice(0, MAX_THREAD_FETCH);

  const summaryByThreadId = new Map<string, string | null>();

  await Promise.all(
    rows.map(async (row) => {
      const summaryRes = await getSummaryFn(row.id);

      if (summaryRes.error || summaryRes.data == null) {
        summaryByThreadId.set(row.id, null);
      } else {
        summaryByThreadId.set(row.id, summaryRes.data);
      }
    })
  );

  let rabbitHoleSources: {
    sessionId: string;
    rootQuestion: string;
    rootTitle?: string | null;
    summary?: string | null;
  }[] = [];

  if (coalescenceMode) {
    const sessionsRes = await getSessionsFn();

    if (sessionsRes.error) {
      logger.error(
        "loadHomepageRoutingCandidates",
        `Rabbit hole sessions fetch failed: ${sessionsRes.error.message}`
      );
    } else {
      rabbitHoleSources =
        sessionsRes.data?.map((m) => ({
          sessionId: m.sessionId,
          rootQuestion: m.rootQuestion,
          rootTitle: m.rootTitle,
          summary: m.summary,
        })) ?? [];
    }
  }

  let strataRoutingRows: StrataRoutingRow[] = [];

  try {
    const { userId } = await auth();

    if (userId) {
      const ownerRes = await getSupabaseUserId(userId);

      if (!ownerRes.error && ownerRes.data) {
        strataRoutingRows = await listStrataPagesWithRoutingExcerpts(ownerRes.data);
      }
    }
  } catch (err) {
    logger.error(
      "loadHomepageRoutingCandidates",
      `Strata routing candidates skipped: ${err instanceof Error ? err.message : String(err)}`
    );
    strataRoutingRows = [];
  }

  return {
    data: buildHomepageRoutingCandidatesFromParts({
      threads: rows,
      summaryByThreadId,
      coalescenceMode,
      rabbitHoleSources,
      strataRoutingRows,
    }),
    error: null,
  };
}
