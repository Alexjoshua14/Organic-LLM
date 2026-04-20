import { memo } from "react";
import { Pin, PinOff } from "lucide-react";

import { cn } from "@/lib/utils";

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
      typeof err === "string" && err.trim().length > 0
        ? err.trim()
        : "Diagram generation failed.";
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
  const isError = parsed.kind === "error";
  const title = isError ? "Diagram error" : "Mermaid diagram created";
  const detail: string | null =
    parsed.kind === "error"
      ? parsed.message
      : parsed.validationWarning
        ? `Preview note: ${parsed.validationWarning}`
        : null;

  return (
    <div
      className={cn(
        "not-prose rounded-lg border border-border/60 bg-background-tertiary/30 dark:bg-background-tertiary/20 backdrop-blur-2xl",
        "px-3 py-2",
        isPinned && "sticky top-20 z-30 shadow-[0_8px_30px_-10px_rgba(0,0,0,0.35)]"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-foreground">{title}</div>
          {detail ? (
            <p
              className={cn(
                "mt-1 text-xs leading-snug",
                isError ? "text-destructive" : "text-muted-foreground"
              )}
            >
              {detail}
            </p>
          ) : null}
        </div>
        <button
          aria-label={isPinned ? "Unpin tool output" : "Pin tool output"}
          aria-pressed={isPinned}
          className={cn(
            "h-7 w-7 shrink-0 grid place-content-center rounded",
            "hover:bg-background-tertiary/60 transition-colors"
          )}
          type="button"
          onClick={onTogglePin}
        >
          {isPinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
        </button>
      </div>
    </div>
  );
});

MermaidToolAckCard.displayName = "MermaidToolAckCard";
