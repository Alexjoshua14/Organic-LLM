import "server-only";

import type { WorktableStore } from "@/lib/llm/subagents/worktable/session";

import { randomUUID } from "crypto";

import { decryptFromStorage, encryptForStorage } from "@/lib/crypto/message-encryption";
import { createLogger } from "@/lib/logger";
import { emptyWorktable, parseWorktable } from "@/lib/llm/subagents/worktable/types";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";

/**
 * Orchestrator worktable on the orchestrator's own `threads` row (COA-258). Admin client — RLS
 * is bypassed, so every query filters on `owner_id`. Encrypted like messages, since bundles
 * quote the user, memories, and subagent output.
 *
 * The columns come from `docs/migrations/threads_subagent_worktable.sql`. Until it runs, loads
 * return null and saves report unavailable. `subagent_worktable_rev` is the optimistic lock —
 * a short token, so the guard filter never carries the (large) ciphertext.
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
        .select("subagent_worktable, subagent_worktable_rev")
        .eq("id", threadId)
        .eq("owner_id", ownerId)
        .maybeSingle();

      if (error || !data) {
        if (error) logQueryError("load", error.message);

        return null;
      }

      const stored = (data.subagent_worktable as string | null) ?? null;
      const revision = (data.subagent_worktable_rev as string | null) ?? null;

      if (!stored) return { worktable: emptyWorktable(), revision };

      try {
        return {
          worktable: parseWorktable(
            JSON.parse(decryptFromStorage(stored, worktableContext(ownerId, threadId)))
          ),
          revision,
        };
      } catch {
        logger.warn("load", "unreadable worktable — starting fresh");

        return { worktable: emptyWorktable(), revision };
      }
    },
    save: async (worktable, previousRevision) => {
      const revision = randomUUID();
      const next = encryptForStorage(
        JSON.stringify(worktable),
        worktableContext(ownerId, threadId)
      );
      const base = supabaseAdmin
        .from("threads")
        .update({ subagent_worktable: next, subagent_worktable_rev: revision })
        .eq("id", threadId)
        .eq("owner_id", ownerId);
      const guarded =
        previousRevision === null
          ? base.is("subagent_worktable_rev", null)
          : base.eq("subagent_worktable_rev", previousRevision);
      const { data, error } = await guarded.select("id");

      if (error) {
        logQueryError("save", error.message);

        return { status: "unavailable" };
      }

      return (data?.length ?? 0) > 0 ? { status: "saved", revision } : { status: "conflict" };
    },
  };
}
