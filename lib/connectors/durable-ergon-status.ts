import "server-only";

import type { ErgonConnectionRecord } from "@/lib/schemas/ergon-connection";
import type { UserConnectorsProfile } from "@/lib/schemas/user-connectors";

import { loadUserConnectorsProfile } from "@/lib/connectors/user-connectors-store";
import { ergonPublicStatusForUser } from "@/lib/llm/ergon-config";
import { createLogger } from "@/lib/logger";

const logger = createLogger("lib/connectors/durable-ergon-status.ts");

/**
 * The stored connectors profile never carries Ergon status; it is derived from the durable
 * Ergon connection on every read, so it cannot go stale and a client cannot set it.
 *
 * The two reads are independent, so they run concurrently: wall time is the slower of the two,
 * not their sum. A profile-store failure throws (callers answer 503). An Ergon-status failure
 * only drops the status (reported as not connected) and is logged.
 */
export async function loadUserConnectorsWithErgon(
  sbUserId: string,
  /** An Ergon connection read already started this request; avoids reading the row twice. */
  connectionSnapshot?: Promise<ErgonConnectionRecord | null>
): Promise<UserConnectorsProfile> {
  const [profile, ergon] = await Promise.all([
    loadUserConnectorsProfile(sbUserId),
    ergonPublicStatusForUser(sbUserId, { connectionSnapshot }).catch(() => {
      logger.error("loadUserConnectorsWithErgon", "Ergon status unavailable for this read");

      return null;
    }),
  ]);

  return { ...profile, ergonConnection: ergon?.connected ? ergon : null };
}

/**
 * Turn-time variant: never throws. Without a readable profile the turn simply runs without a
 * dossier. Start it early (before work it does not depend on) so the read is hidden behind it.
 */
export async function loadUserConnectorsForTurn(
  sbUserId: string,
  connectionSnapshot?: Promise<ErgonConnectionRecord | null>
): Promise<UserConnectorsProfile | null> {
  try {
    return await loadUserConnectorsWithErgon(sbUserId, connectionSnapshot);
  } catch {
    logger.error("loadUserConnectorsForTurn", "Connectors profile unavailable for this turn");

    return null;
  }
}
