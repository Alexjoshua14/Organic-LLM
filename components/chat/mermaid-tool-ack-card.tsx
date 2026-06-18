"use client";

import { memo, useState } from "react";

import {
  ToolResultInlineRow,
  ToolResultPinButton,
  toolResultErrorSummaryButtonClass,
  toolResultExpandedDetailClass,
  toolResultSummaryButtonClass,
} from "./tool-result-inline";

const VALIDATION_NOTE_MAX = 120;

export type ParsedMermaidToolOutput =
  | { kind: "ok"; validationWarning?: string }
  | { kind: "error"; message: string };

/**
 * Parses `make_mermaid_diagram` tool output or a plain error string from tool `output-error`.
 */
export function tryParseMermaidToolOutput(body: unknown): ParsedMermaidToolOutput | null {
  if (typeof body === "string") {
    const t = body.trim();

    return { kind: "error", message: t.length > 0 ? t : "Diagram generation failed." };
  }

  if (body === null || body === undefined || typeof body !== "object") return null;

  const o = body as Record<string, unknown>;

  if (o.success === false) {
    const err = o.error ?? o.validationError;
    const message =
      typeof err === "string" && err.trim().length > 0 ? err.trim() : "Diagram generation failed.";

    return { kind: "error", message };
  }

  if (o.success === true && typeof o.code === "string" && o.code.trim().length > 0) {
    const ve = o.validationError;
    let validationWarning: string | undefined;

    if (typeof ve === "string" && ve.trim().length > 0) {
      const s = ve.trim();

      validationWarning =
        s.length > VALIDATION_NOTE_MAX ? `${s.slice(0, VALIDATION_NOTE_MAX).trimEnd()}…` : s;
    }

    return { kind: "ok", validationWarning };
  }

  return null;
}

type MermaidToolAckCardProps = {
  parsed: ParsedMermaidToolOutput;
  isPinned: boolean;
  onTogglePin: () => void;
};

export const MermaidToolAckCard = memo(function MermaidToolAckCard({
  parsed,
  isPinned,
  onTogglePin,
}: MermaidToolAckCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isError = parsed.kind === "error";
  const title = isError ? "Diagram error" : "Mermaid diagram created";
  const detail: string | null =
    parsed.kind === "error"
      ? parsed.message
      : parsed.validationWarning
        ? `Preview note: ${parsed.validationWarning}`
        : null;

  return (
    <ToolResultInlineRow
      isPinned={isPinned}
      pin={<ToolResultPinButton isPinned={isPinned} onTogglePin={onTogglePin} />}
    >
      <button
        className={isError ? toolResultErrorSummaryButtonClass : toolResultSummaryButtonClass}
        type="button"
        onClick={() => setExpanded((open) => !open)}
      >
        <span className={isError ? "text-destructive/90" : undefined}>{title}</span>
        {expanded && detail ? (
          <span
            className={`${toolResultExpandedDetailClass} ${
              isError ? "text-destructive/90" : "text-muted-foreground"
            }`}
          >
            {detail}
          </span>
        ) : null}
      </button>
    </ToolResultInlineRow>
  );
});

MermaidToolAckCard.displayName = "MermaidToolAckCard";
