"use client";

import { memo, useState } from "react";

import {
  ToolResultInlineRow,
  ToolResultPinButton,
  toolResultErrorSummaryButtonClass,
  toolResultExpandedDetailClass,
  toolResultSummaryButtonClass,
} from "./tool-result-inline";

export type ParsedFullChatHistoryToolOutput =
  | { kind: "ok"; count: number }
  | { kind: "error"; message: string };

/**
 * Parses the `get_full_chat_history` tool return shape from {@link createGetFullChatHistoryTool}.
 */
export function tryParseFullChatHistoryToolOutput(
  body: unknown,
): ParsedFullChatHistoryToolOutput | null {
  if (body === null || body === undefined || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;

  if (typeof o.success !== "boolean") return null;
  if (typeof o.count !== "number" || !Number.isFinite(o.count)) return null;

  if (o.success) {
    return { kind: "ok", count: Math.max(0, Math.floor(o.count)) };
  }
  const err = o.error;
  const message =
    typeof err === "string" && err.trim().length > 0 ? err.trim() : "Could not load chat history.";

  return { kind: "error", message };
}

type FullChatHistoryToolResultCardProps = {
  parsed: ParsedFullChatHistoryToolOutput;
  isPinned: boolean;
  onTogglePin: () => void;
};

export const FullChatHistoryToolResultCard = memo(function FullChatHistoryToolResultCard({
  parsed,
  isPinned,
  onTogglePin,
}: FullChatHistoryToolResultCardProps) {
  const [expanded, setExpanded] = useState(false);
  const detail =
    parsed.kind === "ok"
      ? `${parsed.count} message${parsed.count === 1 ? "" : "s"} from this chat were included for the reply.`
      : parsed.message;

  return (
    <ToolResultInlineRow
      isPinned={isPinned}
      pin={<ToolResultPinButton isPinned={isPinned} onTogglePin={onTogglePin} />}
    >
      <button
        className={
          parsed.kind === "error" ? toolResultErrorSummaryButtonClass : toolResultSummaryButtonClass
        }
        type="button"
        onClick={() => setExpanded((open) => !open)}
      >
        <span className={parsed.kind === "error" ? "text-destructive/90" : undefined}>
          {parsed.kind === "error"
            ? "Failed to fetch full chat history"
            : "Fetched full chat history"}
        </span>
        {expanded ? (
          <span
            className={`${toolResultExpandedDetailClass} ${
              parsed.kind === "error" ? "text-destructive/90" : "text-muted-foreground"
            }`}
          >
            {detail}
          </span>
        ) : null}
      </button>
    </ToolResultInlineRow>
  );
});

FullChatHistoryToolResultCard.displayName = "FullChatHistoryToolResultCard";
