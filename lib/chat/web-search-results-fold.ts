import { getToolOrDynamicToolName, isToolUIPart } from "ai";

import {
  appendWebSearchContext,
  parseWebSearchToolOutputForFold,
  type ParsedWebSearchToolOutput,
} from "@/lib/chat/web-search-tool-output";

/**
 * One `web_search` tool invocation within a single assistant message.
 * Status mirrors tool UI state; completed bodies come from the existing
 * output-available / result path — this module never creates those states.
 */
export type WebSearchInvocationSnapshot = {
  toolCallId: string;
  partIndex: number;
  status: "in-flight" | "completed";
  query?: string;
  /** Raw tool output / error text when `status === "completed"`. */
  body?: unknown;
};

function readQueryFromToolInput(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const q = (input as { query?: unknown }).query;

  return typeof q === "string" && q.trim().length > 0 ? q.trim() : undefined;
}

type LegacyToolInvocationPartLike = {
  type: "tool-invocation";
  toolInvocationId: string;
  toolName: string;
  state: "partial-call" | "call" | "result" | "output-error";
  args?: unknown;
  result?: unknown;
  errorText?: string;
};

function asLegacyToolInvocation(part: unknown): LegacyToolInvocationPartLike | null {
  if (!part || typeof part !== "object") return null;
  const p = part as Record<string, unknown>;

  if (p.type !== "tool-invocation") return null;
  if (typeof p.toolInvocationId !== "string" || typeof p.toolName !== "string") return null;
  if (
    p.state !== "partial-call" &&
    p.state !== "call" &&
    p.state !== "result" &&
    p.state !== "output-error"
  ) {
    return null;
  }

  return p as LegacyToolInvocationPartLike;
}

/**
 * Collects web_search tool parts from a single assistant message's parts list.
 * Scope is always one response — callers must not pass parts from other messages.
 */
export function collectWebSearchSnapshotsFromParts(
  parts: readonly unknown[]
): WebSearchInvocationSnapshot[] {
  const out: WebSearchInvocationSnapshot[] = [];

  parts.forEach((part, partIndex) => {
    if (part && typeof part === "object" && isToolUIPart(part as never)) {
      const toolPart = part as {
        toolCallId: string;
        state: string;
        input?: unknown;
        output?: unknown;
        errorText?: string;
      };
      const toolName = getToolOrDynamicToolName(toolPart as never).toLowerCase();

      if (toolName !== "web_search") return;

      if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
        out.push({
          toolCallId: toolPart.toolCallId,
          partIndex,
          status: "in-flight",
          query: readQueryFromToolInput(toolPart.input),
        });

        return;
      }

      if (toolPart.state === "output-available" || toolPart.state === "output-error") {
        out.push({
          toolCallId: toolPart.toolCallId,
          partIndex,
          status: "completed",
          query: readQueryFromToolInput(toolPart.input),
          body: toolPart.state === "output-error" ? toolPart.errorText : toolPart.output,
        });
      }

      return;
    }

    const legacy = asLegacyToolInvocation(part);

    if (!legacy || legacy.toolName.toLowerCase() !== "web_search") return;

    if (legacy.state === "partial-call" || legacy.state === "call") {
      out.push({
        toolCallId: legacy.toolInvocationId,
        partIndex,
        status: "in-flight",
        query: readQueryFromToolInput(legacy.args),
      });

      return;
    }

    if (legacy.state === "result" || legacy.state === "output-error") {
      out.push({
        toolCallId: legacy.toolInvocationId,
        partIndex,
        status: "completed",
        query: readQueryFromToolInput(legacy.args),
        body: legacy.state === "output-error" ? legacy.errorText : legacy.result,
      });
    }
  });

  return out;
}

export type WebSearchFoldPlan = {
  /** First completed search that owns the single results card. */
  anchorToolCallId: string | null;
  /** Later completed searches closed into the anchor (not rendered). */
  closedToolCallIds: ReadonlySet<string>;
  /** Combined context for the anchor card. */
  combined: ParsedWebSearchToolOutput | null;
  /** Completed searches folded into `combined` (in message order). */
  completedCount: number;
};

/**
 * Within one assistant response: keep at most one completed web-search results
 * component. Extra completed searches are closed and their context is appended
 * onto the first. In-flight searches are never closed or merged.
 */
export function foldWebSearchResults(
  snapshots: readonly WebSearchInvocationSnapshot[]
): WebSearchFoldPlan {
  const completed = snapshots.filter((s) => s.status === "completed");
  const closedToolCallIds = new Set<string>();

  if (completed.length === 0) {
    return {
      anchorToolCallId: null,
      closedToolCallIds,
      combined: null,
      completedCount: 0,
    };
  }

  const anchor = completed[0]!;
  let combined: ParsedWebSearchToolOutput | null = null;

  for (const snap of completed) {
    const parsed =
      parseWebSearchToolOutputForFold(snap.body, snap.toolCallId) ??
      ({
        status: "error" as const,
        message: typeof snap.body === "string" && snap.body.trim() ? snap.body.trim() : "Web search failed.",
      } satisfies ParsedWebSearchToolOutput);

    combined = appendWebSearchContext(combined, {
      query: snap.query,
      parsed,
    });

    if (snap.toolCallId !== anchor.toolCallId) {
      closedToolCallIds.add(snap.toolCallId);
    }
  }

  return {
    anchorToolCallId: anchor.toolCallId,
    closedToolCallIds,
    combined,
    completedCount: completed.length,
  };
}

/** True when this completed invocation should not render its own results card. */
export function isClosedWebSearchResult(
  plan: WebSearchFoldPlan,
  toolCallId: string
): boolean {
  return plan.closedToolCallIds.has(toolCallId);
}
