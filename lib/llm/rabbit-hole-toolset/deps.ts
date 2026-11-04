import type { RabbitHoleSessionMetadata } from "@/app/rabbitholes/_lib/sessionStorage";
import type { RabbitHoleNodeSearchRow } from "@/data/supabase/rabbitholes";
import type { RabbitHoleSession } from "@/lib/schemas/rabbitHoleSchemas";
import type { Result } from "@/types";

export type SpendGateResult = { ok: true } | { ok: false; error: string };

/**
 * Everything the rabbit hole tools reach outside the module for. Injected so tests run without
 * Supabase, and so the data layer is never imported by the tool code itself.
 */
export type RabbitHoleToolsetDeps = {
  /** The signed-in user's sessions, newest first. */
  listSessions: () => Promise<Result<RabbitHoleSessionMetadata[]>>;
  /** Light node rows (no article HTML) for keyword search. */
  getNodeSearchRows: (sessionIds: string[]) => Promise<Result<RabbitHoleNodeSearchRow[]>>;
  getSession: (sessionId: string) => Promise<Result<RabbitHoleSession | null>>;
  getSessionOwnerId: (sessionId: string) => Promise<string | null>;
  /** Same spend gates the `/generate` route applies before it schedules a node. */
  checkSpend: (sbUserId: string) => Promise<SpendGateResult>;
  scheduleGeneration: (params: {
    sessionId: string;
    nodeId: string;
    serializedSession: string;
  }) => Promise<unknown>;
  newId: () => string;
  now: () => string;
};
