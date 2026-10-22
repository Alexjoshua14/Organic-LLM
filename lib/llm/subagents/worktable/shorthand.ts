import type { UIMessage } from "ai";
import type { SubagentThreadRow } from "@/lib/llm/subagents/threads/snapshot";
import type { ResolvedWorktableItem } from "@/lib/llm/subagents/worktable/types";

import { createDemoSubagents } from "@/lib/arcadia/multitask/demo-roster";
import {
  pickRosterSlotForRole,
  resolveSubagentIdentity,
} from "@/lib/arcadia/multitask/subagent-identity";
import { listRosterHardSetSubagents } from "@/lib/llm/subagents/hard-set/registry";
import { uiMessageText } from "@/lib/llm/subagents/threads/messages";

export type ShorthandPrefix = "node" | "rh" | "out" | "th" | "msg" | "bundle";

export type ParsedShorthandRef = {
  prefix: ShorthandPrefix;
  target: string;
  raw: string;
};

export type RabbitHoleSourceLike = {
  id?: string;
  title: string;
  url: string;
  snippet?: string | null;
  highlights?: string[];
};

export type RabbitHoleBranchLike = {
  id?: string;
  label: string;
  shortDescription?: string;
};

export type RabbitHoleNodeLike = {
  id: string;
  title?: string;
  userQuestion: string;
  refinedQuestion?: string | null;
  summary?: string | null;
  preview?: string | null;
  keyTakeaways?: string[];
  articleHtml?: string | null;
  sources?: RabbitHoleSourceLike[];
  branchSuggestions?: RabbitHoleBranchLike[];
};

export type ShorthandMessageLike =
  | UIMessage
  | {
      id: string;
      role?: string;
      text?: string;
      parts?: UIMessage["parts"];
    };

export type ShorthandResolutionContext = {
  /** Rabbit Hole session nodes keyed by nodeId. */
  nodesById?: Record<string, RabbitHoleNodeLike> | null;
  /** Alias for `nodesById`. */
  rabbitHoleNodes?: Record<string, RabbitHoleNodeLike> | null;
  activeNodeId?: string | null;
  rootNodeId?: string | null;
  children?: ReadonlyArray<SubagentThreadRow>;
  messages?: ReadonlyArray<ShorthandMessageLike>;
  resolveAgentId?: (agent: string) => string | null;
};

export type ShorthandResolutionResult =
  | { ok: true; kind: "item"; item: ResolvedWorktableItem; sourceRef: string }
  | { ok: true; kind: "bundle"; bundle: string; sourceRef: string }
  | { ok: false; error: string };

export type ShorthandBatchResolutionResult =
  | {
      ok: true;
      items: ResolvedWorktableItem[];
      bundles: string[];
    }
  | { ok: false; error: string };

const SHORTHAND_RE = /^(node|rh|out|th|msg|bundle):(.+)$/i;

export function parseShorthandRef(raw: string): ParsedShorthandRef | null {
  const trimmed = raw.trim();
  const match = SHORTHAND_RE.exec(trimmed);

  if (!match) return null;
  const prefix = match[1]!.toLowerCase() as ShorthandPrefix;
  const target = match[2]!.trim();

  if (!target) return null;

  return { prefix, target, raw: trimmed };
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Format a Rabbit Hole node into a compact, structured markdown note without raw HTML bloat.
 */
export function formatRabbitHoleNodeForWorktable(
  node: RabbitHoleNodeLike,
  nodeId: string = node.id
): string {
  const lines: string[] = [];
  const heading = node.title?.trim() || node.userQuestion.trim();

  lines.push(`Rabbit Hole Node [${nodeId}]: ${heading}`);
  if (node.userQuestion.trim() && node.userQuestion.trim() !== heading) {
    lines.push(`Question: ${node.userQuestion.trim()}`);
  }
  if (node.refinedQuestion?.trim()) {
    lines.push(`Refined Question: ${node.refinedQuestion.trim()}`);
  }

  const synopsis =
    node.summary?.trim() ||
    node.preview?.trim() ||
    (node.articleHtml ? stripHtmlTags(node.articleHtml).slice(0, 600) : "");

  if (synopsis) {
    lines.push(`Summary: ${synopsis}`);
  }

  const takeaways = (node.keyTakeaways ?? []).map((t) => t.trim()).filter(Boolean);

  if (takeaways.length > 0) {
    lines.push("Key Takeaways:");
    for (const takeaway of takeaways) {
      lines.push(`- ${takeaway}`);
    }
  }

  const topSources = (node.sources ?? []).slice(0, 5);

  if (topSources.length > 0) {
    lines.push("Top Sources:");
    for (const src of topSources) {
      const snippet = src.snippet?.trim() || src.highlights?.[0]?.trim();

      lines.push(`- ${src.title} (${src.url})${snippet ? ` — ${snippet.slice(0, 180)}` : ""}`);
    }
  }

  const branches = (node.branchSuggestions ?? []).slice(0, 4);

  if (branches.length > 0) {
    lines.push(
      `Suggested Branches: ${branches
        .map((b) => b.label.trim())
        .filter(Boolean)
        .join(" | ")}`
    );
  }

  return lines.join("\n");
}

function defaultResolveAgentId(
  agent: string,
  children: ReadonlyArray<SubagentThreadRow> = []
): string | null {
  const wanted = agent.trim().replace(/^@/, "").toLowerCase();

  if (!wanted) return null;
  const matches = (agentId: string) =>
    agentId.toLowerCase() === wanted ||
    resolveSubagentIdentity(agentId).name.toLowerCase() === wanted;

  const child = children.find((c) => matches(c.agentId));

  if (child) return child.agentId;
  const slot = createDemoSubagents().find((s) => matches(s.id));

  if (slot) return slot.id;
  const locked = listRosterHardSetSubagents();
  const lockedByName = locked.find(
    (a) => a.id.toLowerCase() === wanted || a.name.toLowerCase() === wanted
  );

  if (lockedByName) return lockedByName.rosterSlotId ?? lockedByName.id;
  const busy = new Set(children.filter((c) => c.status === "working").map((c) => c.agentId));

  return (
    pickRosterSlotForRole(wanted, { busyAgentIds: busy }) ??
    pickRosterSlotForRole(wanted) ??
    locked.find((a) => a.role.toLowerCase() === wanted)?.rosterSlotId ??
    locked.find((a) => a.role.toLowerCase() === wanted)?.id ??
    null
  );
}

function extractMessageText(message: ShorthandMessageLike): string {
  if ("text" in message && typeof message.text === "string") {
    return message.text.trim();
  }
  if ("parts" in message && Array.isArray(message.parts)) {
    return uiMessageText(message as UIMessage, true);
  }

  return "";
}

/**
 * Resolve one shorthand token (`node:<id>`, `rh:<id>`, `out:<agentId>`, `th:<threadId>`, `msg:<id>`, `bundle:<id>`).
 */
export function resolveShorthandRef(
  raw: string,
  context: ShorthandResolutionContext = {}
): ShorthandResolutionResult {
  const parsed = parseShorthandRef(raw);

  if (!parsed) {
    return {
      ok: false,
      error: `Invalid shorthand reference "${raw}". Expected node:<id>, out:<agentId>, th:<threadId>, msg:<messageId>, or bundle:<bundleId>.`,
    };
  }

  const { prefix, target } = parsed;

  if (prefix === "bundle") {
    return {
      ok: true,
      kind: "bundle",
      bundle: target,
      sourceRef: `bundle:${target}`,
    };
  }

  if (prefix === "node" || prefix === "rh") {
    const nodes = context.nodesById ?? context.rabbitHoleNodes ?? null;

    if (!nodes || Object.keys(nodes).length === 0) {
      return {
        ok: false,
        error: `Cannot resolve "${raw}": no Rabbit Hole session graph is active.`,
      };
    }

    let resolvedId = target;
    let node = nodes[resolvedId];

    if (!node && target.toLowerCase() === "active") {
      const candidateId = context.activeNodeId ?? Object.keys(nodes)[0];

      if (candidateId && nodes[candidateId]) {
        resolvedId = candidateId;
        node = nodes[candidateId];
      }
    }
    if (!node && target.toLowerCase() === "root") {
      const candidateId = context.rootNodeId ?? Object.keys(nodes)[0];

      if (candidateId && nodes[candidateId]) {
        resolvedId = candidateId;
        node = nodes[candidateId];
      }
    }
    if (!node) {
      const lower = target.toLowerCase();
      const found = Object.entries(nodes).find(
        ([key, val]) =>
          key.toLowerCase() === lower ||
          val.id.toLowerCase() === lower ||
          val.title?.toLowerCase() === lower
      );

      if (found) {
        resolvedId = found[0];
        node = found[1];
      }
    }

    if (!node) {
      return {
        ok: false,
        error: `Rabbit Hole node "${target}" was not found in the active session graph.`,
      };
    }

    const sourceRef = `node:${node.id || resolvedId}`;
    const label = node.title?.trim()
      ? `${sourceRef} · ${node.title.trim()}`.slice(0, 120)
      : sourceRef.slice(0, 120);

    return {
      ok: true,
      kind: "item",
      sourceRef,
      item: {
        kind: "note",
        label,
        text: formatRabbitHoleNodeForWorktable(node, node.id || resolvedId),
        sourceMessageId: null,
        sourceRef,
        agentId: null,
      },
    };
  }

  if (prefix === "out" || prefix === "th") {
    const children = context.children ?? [];
    const resolveAgent =
      context.resolveAgentId ?? ((agent: string) => defaultResolveAgentId(agent, children));
    let agentId: string | null = null;

    if (prefix === "th") {
      const byThread = children.find((c) => c.threadId.toLowerCase() === target.toLowerCase());

      agentId = byThread?.agentId ?? resolveAgent(target);
    } else {
      agentId = resolveAgent(target);
    }

    if (!agentId) {
      return {
        ok: false,
        error: `Cannot resolve "${raw}": no specialist or subagent thread matched "${target}".`,
      };
    }

    const identity = resolveSubagentIdentity(agentId);
    const sourceRef = `${prefix}:${prefix === "th" ? target : agentId}`;

    return {
      ok: true,
      kind: "item",
      sourceRef,
      item: {
        kind: "live_subagent_output",
        label: `${identity.name} (${identity.role})`,
        text: "",
        sourceMessageId: null,
        sourceRef,
        agentId,
      },
    };
  }

  // prefix === "msg"
  const messages = context.messages ?? [];
  const matched = messages.find((m) => m.id === target);

  if (!matched) {
    return {
      ok: false,
      error: `Message "${target}" was not found in the recent orchestrator thread history.`,
    };
  }

  const text = extractMessageText(matched);

  if (!text) {
    return {
      ok: false,
      error: `Message "${target}" has no text content to attach.`,
    };
  }

  const isUser = ("role" in matched ? matched.role : "user") === "user";
  const sourceRef = `msg:${matched.id}`;

  return {
    ok: true,
    kind: "item",
    sourceRef,
    item: {
      kind: isUser ? "user_message" : "note",
      label: `msg:${matched.id}`,
      text,
      sourceMessageId: matched.id,
      sourceRef,
      agentId: null,
    },
  };
}

/**
 * Expand a list of shorthand tokens into resolved worktable items and bundle selections.
 */
export function resolveShorthandRefs(
  refs: ReadonlyArray<string> | undefined,
  context: ShorthandResolutionContext = {}
): ShorthandBatchResolutionResult {
  const items: ResolvedWorktableItem[] = [];
  const bundles: string[] = [];

  for (const raw of refs ?? []) {
    const resolved = resolveShorthandRef(raw, context);

    if (!resolved.ok) {
      return { ok: false, error: resolved.error };
    }
    if (resolved.kind === "bundle") {
      if (!bundles.includes(resolved.bundle)) {
        bundles.push(resolved.bundle);
      }
    } else {
      items.push(resolved.item);
    }
  }

  return { ok: true, items, bundles };
}
