import "server-only";
import { SubscriptionError } from "./policy";

import { isProfileUuid } from "@/lib/connectors/repo-utils";

export type LeaseKind = "connection" | "turn";
export interface SubscriptionRepository {
  read(ownerId: string): Promise<string | null>;
  write(ownerId: string, lease: string, ciphertext: string): Promise<void>;
  acquire(ownerId: string, kind: LeaseKind, lease: string): Promise<boolean>;
  release(ownerId: string, kind: LeaseKind, lease: string): Promise<void>;
}

// All operations are scoped by a canonical profile resolved from the server session.
// The service-only RPC also fences writes/releases by unexpired random lease tokens.
async function rpc(
  ownerId: string,
  action: string,
  kind = "connection",
  lease?: string,
  payload?: string
) {
  if (!isProfileUuid(ownerId)) throw new SubscriptionError("Invalid connection owner.", 403);
  const { supabaseAdmin } = await import("@/lib/supabase/supabase-admin");
  const { data, error } = await supabaseAdmin.rpc("subscription_connection_operation", {
    p_owner: ownerId,
    p_action: action,
    p_kind: kind,
    p_lease: lease ?? null,
    p_payload: payload ?? null,
  });

  if (error) throw new SubscriptionError("Subscription storage is temporarily unavailable.", 503);

  return data;
}
export const subscriptionRepository: SubscriptionRepository = {
  async read(owner) {
    return (await rpc(owner, "read")) as string | null;
  },
  async write(owner, lease, payload) {
    if ((await rpc(owner, "write", "connection", lease, payload)) !== true)
      throw new SubscriptionError("Connection changed or expired. Reconnect to continue.", 409);
  },
  async acquire(owner, kind, lease) {
    return (await rpc(owner, "acquire", kind, lease)) === true;
  },
  async release(owner, kind, lease) {
    await rpc(owner, "release", kind, lease);
  },
};
