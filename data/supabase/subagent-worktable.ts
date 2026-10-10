import "server-only";

import type { WorktableStore } from "@/lib/llm/subagents/worktable/session";

import { decryptFromStorage, encryptForStorage } from "@/lib/crypto/message-encryption";
import { createLogger } from "@/lib/logger";
import { emptyWorktable, parseWorktable } from "@/lib/llm/subagents/worktable/types";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";

/**
 * Orchestrator worktable on the orchestrator's own `threads` row (COA-258). Admin client — RLS
 * is bypassed, so every query filters on `owner_id`. Encrypted like messages, since bundles
 * quote the user, memories, and subagent output.
 *
 * The column comes from `docs/migrations/threads_subagent_worktable.sql`. Until it runs, loads
 * return null and saves report unavailable.
 */

const logger = createLogger("data/supabase/subagent-worktable.ts");

function isMissingWorktableColumn(message: string | null | undefined): boolean {
  return Boolean(
    message?.includes("subagent_worktable") &&
      (message.includes("does not exist") || message.includes("Could not find"))
  );
}

function logQueryError(fn: string, message: string): void {
  if (isMissingWorktableColumn(message)) {
    logger.warn(fn, "subagent_worktable column missing — run threads_subagent_worktable.sql");

    return;
  }
  logger.error(fn, message);
}

function worktableContext(ownerId: string, threadId: string) {
  return { userId: ownerId, threadId, fieldName: "threads.subagent_worktable" as const };
}

export function createSupabaseWorktableStore(args: {
  threadId: string;
  ownerId: string;
}): WorktableStore {
  const { threadId, ownerId } = args;

  return {
    load: async () => {
      const { data, error } = await supabaseAdmin
        .from("threads")
        .select("subagent_worktable")
        .eq("id", threadId)
        .eq("owner_id", ownerId)
        .maybeSingle();

      if (error || !data) {
        if (error) logQueryError("load", error.message);

        return null;
      }

      const stored = (data.subagent_worktable as string | null) ?? null;

      if (!stored) return { worktable: emptyWorktable(), revision: null };

      try {
        return {
          worktable: parseWorktable(
            JSON.parse(decryptFromStorage(stored, worktableContext(ownerId, threadId)))
          ),
          revision: stored,
        };
      } catch {
        logger.warn("load", "unreadable worktable — starting fresh");

        return { worktable: emptyWorktable(), revision: stored };
      }
    },
    save: async (worktable, previousRevision) => {
      const next = encryptForStorage(
        JSON.stringify(worktable),
        worktableContext(ownerId, threadId)
      );
      const base = supabaseAdmin
        .from("threads")
        .update({ subagent_worktable: next })
        .eq("id", threadId)
        .eq("owner_id", ownerId);
      const guarded =
        previousRevision === null
          ? base.is("subagent_worktable", null)
          : base.eq("subagent_worktable", previousRevision);
      const { data, error } = await guarded.select("id");

      if (error) {
        logQueryError("save", error.message);

        return { status: "unavailable" };
      }

      return (data?.length ?? 0) > 0 ? { status: "saved", revision: next } : { status: "conflict" };
    },
  };
}
