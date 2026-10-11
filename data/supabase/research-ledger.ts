import "server-only";

import type { ResearchLedgerStore } from "@/lib/llm/subagents/research/ledger";
import type { MessageEncryptionService } from "@/lib/crypto/message-encryption";

import { randomUUID } from "node:crypto";

import { decryptFromStorage, encryptForStorage } from "@/lib/crypto/message-encryption";
import { emptyResearchLedger, ResearchLedgerSchema } from "@/lib/llm/subagents/research/ledger";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";

/** Same encrypted, owner-scoped optimistic-lock contract as the orchestrator worktable. */
export function createSupabaseResearchLedgerStore(
  args: { threadId: string; ownerId: string },
  dependencies: {
    client?: Pick<typeof supabaseAdmin, "from">;
    encryption?: Pick<MessageEncryptionService, "encryptForStorage" | "decryptFromStorage">;
  } = {}
): ResearchLedgerStore {
  const { threadId, ownerId } = args;
  const client = dependencies.client ?? supabaseAdmin;
  const encryption = dependencies.encryption ?? { encryptForStorage, decryptFromStorage };
  const context = { userId: ownerId, threadId, fieldName: "threads.research_ledger" as const };

  return {
    load: async () => {
      const { data, error } = await client
        .from("threads")
        .select("research_ledger, research_ledger_rev")
        .eq("id", threadId)
        .eq("owner_id", ownerId)
        .maybeSingle();

      if (error || !data) return null;
      if (!data.research_ledger)
        return { ledger: emptyResearchLedger(), revision: data.research_ledger_rev };
      try {
        const parsed = ResearchLedgerSchema.safeParse(
          JSON.parse(encryption.decryptFromStorage(data.research_ledger, context))
        );

        return parsed.success ? { ledger: parsed.data, revision: data.research_ledger_rev } : null;
      } catch {
        return null;
      }
    },
    save: async (ledger, previousRevision) => {
      const revision = randomUUID();
      const base = client
        .from("threads")
        .update({
          research_ledger: encryption.encryptForStorage(JSON.stringify(ledger), context),
          research_ledger_rev: revision,
        })
        .eq("id", threadId)
        .eq("owner_id", ownerId);
      const guarded =
        previousRevision === null
          ? base.is("research_ledger_rev", null)
          : base.eq("research_ledger_rev", previousRevision);
      const { data, error } = await guarded.select("id");

      if (error) return { status: "unavailable" };

      return data?.length ? { status: "saved", revision } : { status: "conflict" };
    },
  };
}
