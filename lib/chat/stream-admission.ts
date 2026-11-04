import "server-only";

import { randomUUID } from "crypto";

import { supabaseAdmin } from "@/lib/supabase/supabase-admin";
import { createLogger } from "@/lib/logger";

const logger = createLogger("lib/chat/stream-admission.ts");

type AdmissionClient = Pick<typeof supabaseAdmin, "rpc" | "from">;

export type StreamAdmissionDenial = "busy" | "capacity" | "not_found";

/**
 * Policy lives in SQL (`docs/migrations/chat_stream_subagent_allotment.sql`): at most 5 active
 * threads per owner, and at most 5 subagents per active orchestrator thread.
 */
async function acquireLease(
  client: AdmissionClient,
  fn: "acquire_chat_stream_lease" | "acquire_subagent_stream_lease",
  args: Record<string, string>,
  lease: { ownerId: string; threadId: string; token: string }
) {
  const { data, error } = await client.rpc(fn, args);

  if (error) throw new Error("Stream admission unavailable");
  if (data !== "acquired") {
    if (data !== "busy" && data !== "capacity" && data !== "not_found") {
      throw new Error("Unexpected stream admission result");
    }

    return { ok: false as const, reason: data as StreamAdmissionDenial };
  }

  return {
    ok: true as const,
    async release() {
      try {
        const { error: releaseError } = await client
          .from("chat_stream_leases")
          .delete()
          .eq("owner_id", lease.ownerId)
          .eq("thread_id", lease.threadId)
          .eq("token", lease.token);

        if (releaseError) throw releaseError;
      } catch {
        // Expiry recovers failed cleanup; never remove another holder's lease.
        logger.error("release", "Stream lease cleanup failed", { token: lease.token });
      }
    },
  };
}

export type StreamAdmission = Awaited<ReturnType<typeof acquireLease>>;

/** A chat turn (live or queued) on `threadId`. `client` is injectable for tests. */
export async function acquireChatStreamLease(
  ownerId: string,
  threadId: string,
  client: AdmissionClient = supabaseAdmin
): Promise<StreamAdmission> {
  const token = randomUUID();

  return acquireLease(
    client,
    "acquire_chat_stream_lease",
    { p_owner_id: ownerId, p_thread_id: threadId, p_token: token },
    { ownerId, threadId, token }
  );
}

/**
 * A subagent worker turn on `threadId`, counted against its orchestrator `parentThreadId` rather
 * than the owner's chat slots. The orchestrator stays active while any worker holds a lease.
 */
export async function acquireSubagentStreamLease(
  ownerId: string,
  parentThreadId: string,
  threadId: string,
  client: AdmissionClient = supabaseAdmin
): Promise<StreamAdmission> {
  const token = randomUUID();

  return acquireLease(
    client,
    "acquire_subagent_stream_lease",
    {
      p_owner_id: ownerId,
      p_parent_thread_id: parentThreadId,
      p_thread_id: threadId,
      p_token: token,
    },
    { ownerId, threadId, token }
  );
}
