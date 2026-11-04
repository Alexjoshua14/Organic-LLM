import "server-only";

import { randomUUID } from "crypto";

import { supabaseAdmin } from "@/lib/supabase/supabase-admin";
import { createLogger } from "@/lib/logger";

const logger = createLogger("lib/chat/stream-admission.ts");

export async function acquireChatStreamLease(ownerId: string, threadId: string) {
  const token = randomUUID();
  const { data, error } = await supabaseAdmin.rpc("acquire_chat_stream_lease", {
    p_owner_id: ownerId,
    p_thread_id: threadId,
    p_token: token,
  });

  if (error) throw new Error("Stream admission unavailable");
  if (data !== "acquired") {
    if (data !== "busy" && data !== "capacity" && data !== "not_found") {
      throw new Error("Unexpected stream admission result");
    }

    return { ok: false as const, reason: data as "busy" | "capacity" | "not_found" };
  }

  return {
    ok: true as const,
    async release() {
      try {
        const { error: releaseError } = await supabaseAdmin
          .from("chat_stream_leases")
          .delete()
          .eq("owner_id", ownerId)
          .eq("thread_id", threadId)
          .eq("token", token);

        if (releaseError) throw releaseError;
      } catch {
        // Expiry recovers failed cleanup; never remove another holder's lease.
        logger.error("release", "Stream lease cleanup failed", { token });
      }
    },
  };
}
