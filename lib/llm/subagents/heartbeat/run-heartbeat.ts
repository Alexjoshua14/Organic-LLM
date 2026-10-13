import { createHash } from "crypto";

import type { LanguageModelUsage, UIMessage } from "ai";
import type {
  SubagentThreadRow,
  SubagentThreadSnapshot,
} from "@/lib/llm/subagents/threads/snapshot";

import {
  buildHeartbeatSystemMessage,
  evaluateSubagentHeartbeat,
} from "@/lib/llm/subagents/heartbeat/evaluate";
import {
  buildSubagentThreadSnapshot,
  digestSubagentSnapshots,
  SUBAGENT_SNAPSHOT_MESSAGE_WINDOW,
} from "@/lib/llm/subagents/threads/snapshot";

/**
 * Server floor between Jev evaluations for one orchestrator thread, whatever the client asks.
 * Below the fastest client cadence (Performance, 30s) so honest clients never hit it; it exists
 * so several tabs or a misbehaving client cannot hammer Jev.
 */
export const SUBAGENT_HEARTBEAT_SERVER_MIN_INTERVAL_MS = 30_000;

export type SubagentHeartbeatDeps = {
  listChildren(): Promise<SubagentThreadRow[]>;
  loadMessages(threadId: string, limit: number): Promise<UIMessage[]>;
  getState(): Promise<{
    baseline: SubagentThreadSnapshot[] | null;
    digest: string | null;
    at: string | null;
  } | null>;
  /** Timestamp compare-and-set; a crashed evaluation is retried after the lease expires. */
  claim(args: { previousAt: string | null; at: string }): Promise<boolean>;
  complete(args: { at: string; digest: string; baseline?: SubagentThreadSnapshot[] }): Promise<void>;
  enqueueReply(message: UIMessage): Promise<void>;
  appendSystemMessage(message: UIMessage): Promise<boolean>;
  recordUsage(args: { modelId: string; usage?: LanguageModelUsage; providerMetadata?: unknown }): void;
  evaluate?: typeof evaluateSubagentHeartbeat;
};

export type SubagentHeartbeatOutcome =
  | { status: "no-subagents" | "unavailable" | "too-soon" | "unchanged" | "claimed-elsewhere" }
  | { status: "quiet" }
  | { status: "notable"; message: UIMessage }
  | { status: "error"; error: string };

/**
 * One heartbeat for an orchestrator thread. Cheap when nothing moved: the digest check runs
 * before Jev, and only one client wins each change. When Jev fires true, a system message lands
 * in the orchestrator's thread and the baseline moves to the current board.
 */
export async function runSubagentHeartbeat(args: {
  ownerId: string;
  deps: SubagentHeartbeatDeps;
  now?: () => number;
}): Promise<SubagentHeartbeatOutcome> {
  const { deps, ownerId } = args;
  const now = args.now ?? Date.now;

  const children = await deps.listChildren();

  if (children.length === 0) return { status: "no-subagents" };

  const state = await deps.getState();

  if (!state) return { status: "unavailable" };

  const lastAt = state.at ? Date.parse(state.at) : Number.NaN;

  if (Number.isFinite(lastAt) && now() - lastAt < SUBAGENT_HEARTBEAT_SERVER_MIN_INTERVAL_MS) {
    return { status: "too-soon" };
  }

  const current = await Promise.all(
    children.map(async (row) =>
      buildSubagentThreadSnapshot(
        row,
        await deps.loadMessages(row.threadId, SUBAGENT_SNAPSHOT_MESSAGE_WINDOW),
        now()
      )
    )
  );
  const digest = digestSubagentSnapshots(current);

  if (digest === state.digest) return { status: "unchanged" };

  const at = new Date(now()).toISOString();
  const claimed = await deps.claim({ previousAt: state.at, at });

  if (!claimed) return { status: "claimed-elsewhere" };

  try {
    const result = await (deps.evaluate ?? evaluateSubagentHeartbeat)({
      previous: state.baseline ?? [],
      current,
      ownerId,
    });

    await deps.recordUsage({
      modelId: result.modelId,
      usage: result.usage,
      providerMetadata: result.providerMetadata,
    });

    if (!result.decision.notable) {
      await deps.complete({ at, digest });
      return { status: "quiet" };
    }

    // Stable across retries: neither a failed write nor a crashed request duplicates notices/replies.
    const hex = createHash("sha256").update(JSON.stringify([ownerId, state.digest, digest])).digest("hex");
    const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
    const message = buildHeartbeatSystemMessage({ events: result.decision.events, at: now(), id });

    if (!(await deps.appendSystemMessage(message))) throw new Error("Could not save heartbeat notice");
    await deps.enqueueReply(message);
    await deps.complete({ at, digest, baseline: current });

    return { status: "notable", message };
  } catch (err) {
    // Leave the successful digest/baseline unchanged. The next cadence retries after the lease.

    return { status: "error", error: err instanceof Error ? err.message : String(err) };
  }
}
