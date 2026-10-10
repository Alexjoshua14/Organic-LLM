import type { UIMessage } from "ai";

import { createHash } from "crypto";

import { resolveSubagentIdentity } from "@/lib/arcadia/multitask/subagent-identity";
import { stripSubagentGoalPrefix, uiMessageText } from "@/lib/llm/subagents/threads/messages";
import {
  resolveEffectiveSubagentStatus,
  type SubagentThreadStatus,
} from "@/lib/llm/subagents/threads/status";

/** A child thread row as read from `threads` (subagent columns only). */
export type SubagentThreadRow = {
  threadId: string;
  agentId: string;
  status: string | null;
  statusAt: string | null;
};

/**
 * What the orchestrator (and the heartbeat) knows about one subagent thread: identity, effective
 * status, and short excerpts of the latest assignment and outcome.
 */
export type SubagentThreadSnapshot = {
  agentId: string;
  threadId: string;
  name: string;
  role: string;
  status: SubagentThreadStatus;
  statusAt: string | null;
  lastMessageId: string | null;
  lastGoal: string | null;
  lastOutcome: string | null;
};

/** Excerpt ceiling per field — enough for a status line, not a transcript. */
export const SUBAGENT_SNAPSHOT_EXCERPT_CHARS = 400;

/** Messages per child thread read to build a snapshot. */
export const SUBAGENT_SNAPSHOT_MESSAGE_WINDOW = 6;

export function clampExcerpt(text: string, max = SUBAGENT_SNAPSHOT_EXCERPT_CHARS): string {
  const cleaned = text.replace(/\s+/g, " ").trim();

  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
}

function lastTextOfRole(messages: ReadonlyArray<UIMessage>, role: UIMessage["role"]): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]!;

    if (message.role !== role) continue;
    const text = role === "user" ? stripSubagentGoalPrefix(uiMessageText(message)) : uiMessageText(message);

    if (text) return clampExcerpt(text);
  }

  return null;
}

/** Build one snapshot from a child row and its recent messages (chronological). */
export function buildSubagentThreadSnapshot(
  row: SubagentThreadRow,
  messages: ReadonlyArray<UIMessage>,
  now: number = Date.now()
): SubagentThreadSnapshot {
  const identity = resolveSubagentIdentity(row.agentId);

  return {
    agentId: row.agentId,
    threadId: row.threadId,
    name: identity.name,
    role: identity.role,
    status: resolveEffectiveSubagentStatus(row.status, row.statusAt, now),
    statusAt: row.statusAt,
    lastMessageId: messages.at(-1)?.id ?? null,
    lastGoal: lastTextOfRole(messages, "user"),
    lastOutcome: lastTextOfRole(messages, "assistant"),
  };
}

/**
 * Stable digest of what can change on the board: status and the newest message per thread.
 * Equal digests mean the heartbeat has nothing new to show Jev.
 */
export function digestSubagentSnapshots(snapshots: ReadonlyArray<SubagentThreadSnapshot>): string {
  const keyed = [...snapshots]
    .sort((a, b) => a.threadId.localeCompare(b.threadId))
    .map((s) => [s.threadId, s.agentId, s.status, s.lastMessageId ?? "", s.lastGoal, s.lastOutcome]);

  return createHash("sha256").update(JSON.stringify(keyed)).digest("hex");
}

const STATUS_LABEL: Record<SubagentThreadStatus, string> = {
  idle: "idle",
  working: "working",
  done: "done",
  blocked: "blocked (failed or stalled)",
};

/**
 * System fragment for each orchestrator turn: who is running what, and how it went. Full threads
 * stay behind the `read_subagent_thread` tool.
 */
export function formatSubagentStatusFragment(
  snapshots: ReadonlyArray<SubagentThreadSnapshot>
): string | null {
  if (snapshots.length === 0) return null;

  const lines = snapshots.map((s) => {
    const parts = [`- ${s.name} (${s.role}, agentId=${s.agentId}) — ${STATUS_LABEL[s.status]}`];

    if (s.lastGoal) parts.push(`  Latest assignment: ${s.lastGoal}`);
    if (s.lastOutcome) parts.push(`  Latest outcome: ${s.lastOutcome}`);

    return parts.join("\n");
  });

  return [
    "[Subagent threads]",
    "Each subagent works asynchronously in its own thread. This is a status summary, not the full",
    "thread. Call read_subagent_thread with an agentId when you need a subagent's actual messages.",
    "Do not claim a subagent finished unless its status says done.",
    ...lines,
  ].join("\n");
}
