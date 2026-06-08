import { memo } from "react";
import { Pin, PinOff } from "lucide-react";

import { cn } from "@/lib/utils";

export type ParsedFullChatHistoryToolOutput =
  | { kind: "ok"; count: number }
  | { kind: "error"; message: string };

/**
 * Parses the `get_full_chat_history` tool return shape from {@link createGetFullChatHistoryTool}.
 */
export function tryParseFullChatHistoryToolOutput(
  body: unknown
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
  const detail =
    parsed.kind === "ok"
      ? `${parsed.count} message${parsed.count === 1 ? "" : "s"} from this chat were included for the reply.`
      : parsed.message;

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
          <div className="text-xs font-medium text-foreground">Fetched full chat history</div>
          <p
            className={cn(
              "mt-1 text-xs leading-snug",
              parsed.kind === "error" ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {detail}
          </p>
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

FullChatHistoryToolResultCard.displayName = "FullChatHistoryToolResultCard";
