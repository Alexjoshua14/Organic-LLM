import "server-only";

import type { ResearchLedgerStore } from "@/lib/llm/subagents/research/ledger";
import type { MessageEncryptionService } from "@/lib/crypto/message-encryption";

import { randomUUID } from "node:crypto";

import { decryptFromStorage, encryptForStorage } from "@/lib/crypto/message-encryption";
import { emptyResearchLedger, ResearchLedgerSchema } from "@/lib/llm/subagents/research/ledger";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";

/** Threads hold a foreign key; evidence/reuse lives in an independently owned encrypted ledger row. */
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
  let loadedLedgerId: string | null = null;
  const context = (id: string) => ({
    userId: ownerId,
    threadId: id,
    fieldName: "research_ledgers.payload" as const,
  });

  async function ownedThread() {
    const { data, error } = await client
      .from("threads")
      .select("research_ledger_id")
      .eq("id", threadId)
      .eq("owner_id", ownerId)
      .maybeSingle();

    return error ? null : data;
  }
  async function resolveLedgerId(): Promise<string | null> {
    const thread = await ownedThread();

    if (!thread) return null;
    if (thread.research_ledger_id) return thread.research_ledger_id;
    const id = randomUUID();
    const created = await client.from("research_ledgers").insert({ id, owner_id: ownerId });

    if (created.error) return null;
    const linked = await client
      .from("threads")
      .update({ research_ledger_id: id })
      .eq("id", threadId)
      .eq("owner_id", ownerId)
      .is("research_ledger_id", null)
      .select("id");

    if (!linked.error && linked.data?.length) return id;
    // Another initializer won. The FK protects an acknowledged or uncertain successful link.
    await client.from("research_ledgers").delete().eq("id", id).eq("owner_id", ownerId);

    return (await ownedThread())?.research_ledger_id ?? null;
  }

  return {
    load: async () => {
      loadedLedgerId = null;
      const id = await resolveLedgerId();

      if (!id) return null;
      const { data, error } = await client
        .from("research_ledgers")
        .select("payload, payload_rev, legacy_thread_id")
        .eq("id", id)
        .eq("owner_id", ownerId)
        .maybeSingle();

      if (error || !data) return null;
      if (!data.payload) {
        loadedLedgerId = id;

        return { ledger: emptyResearchLedger(), revision: data.payload_rev };
      }
      try {
        // SQL backfill moves ciphertext unchanged. The next successful write upgrades its AAD.
        const encryptedContext = data.legacy_thread_id
          ? {
              userId: ownerId,
              threadId: data.legacy_thread_id,
              fieldName: "threads.research_ledger" as const,
            }
          : context(id);
        const parsed = ResearchLedgerSchema.safeParse(
          JSON.parse(encryption.decryptFromStorage(data.payload, encryptedContext))
        );

        if (!parsed.success) return null;
        loadedLedgerId = id;

        return { ledger: parsed.data, revision: data.payload_rev };
      } catch {
        return null;
      }
    },
    save: async (ledger, previousRevision) => {
      const thread = await ownedThread();

      if (!thread) return { status: "unavailable" };
      if (!loadedLedgerId || thread.research_ledger_id !== loadedLedgerId)
        return { status: "conflict" };
      const revision = randomUUID();
      const base = client
        .from("research_ledgers")
        .update({
          payload: encryption.encryptForStorage(JSON.stringify(ledger), context(loadedLedgerId)),
          payload_rev: revision,
          legacy_thread_id: null,
        })
        .eq("id", loadedLedgerId)
        .eq("owner_id", ownerId);
      const guarded =
        previousRevision === null
          ? base.is("payload_rev", null)
          : base.eq("payload_rev", previousRevision);
      const { data, error } = await guarded.select("id");

      if (error) return { status: "unavailable" };

      return data?.length ? { status: "saved", revision } : { status: "conflict" };
    },
  };
}
