import type { RabbitHoleSession } from "@/lib/schemas/rabbitHoleSchemas";
import type { RabbitHoleToolsetDeps } from "./deps";

import { estimateTokens, RABBIT_HOLE_TOOL_RESPONSE_TOKEN_CAP } from "./shape";

/** One message for "missing" and "someone else's", so a model can't probe for other users' ids. */
export const RABBIT_HOLE_NOT_FOUND = "Rabbit hole not found.";

export type OwnedSessionResult =
  | { ok: true; session: RabbitHoleSession }
  | { ok: false; error: string };

/**
 * Load a session by an id the model supplied, only if it belongs to `sbUserId`. Row-level
 * security already scopes the user's client; the explicit owner check is the second lock.
 */
export async function loadOwnedSession(
  deps: Pick<RabbitHoleToolsetDeps, "getSession" | "getSessionOwnerId">,
  sbUserId: string,
  sessionId: string
): Promise<OwnedSessionResult> {
  const ownerId = await deps.getSessionOwnerId(sessionId);

  if (!ownerId || ownerId !== sbUserId) return { ok: false, error: RABBIT_HOLE_NOT_FOUND };

  const res = await deps.getSession(sessionId);

  if (res.error || !res.data) return { ok: false, error: RABBIT_HOLE_NOT_FOUND };

  return { ok: true, session: res.data };
}

/**
 * Temporary development guard on what one tool call may hand back. It sits on the tool callers
 * rather than on the shaping functions, so a session's real size stays readable.
 */
export function gateResponseSize<T extends object>(
  payload: T,
  cap = RABBIT_HOLE_TOOL_RESPONSE_TOKEN_CAP
):
  | { ok: true; payload: T }
  | { ok: false; error: string; estimatedTokens: number; capTokens: number } {
  const estimatedTokens = estimateTokens(JSON.stringify(payload));

  if (estimatedTokens <= cap) return { ok: true, payload };

  return {
    ok: false,
    estimatedTokens,
    capTokens: cap,
    error: `This would return about ${estimatedTokens} tokens, over the temporary ${cap}-token limit. Read with detail "overview" or "high_level", or fetch a single node or section instead.`,
  };
}
