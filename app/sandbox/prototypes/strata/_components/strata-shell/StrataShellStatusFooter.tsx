"use client";

import type { ActionStatusState } from "./strata-shell-model";

import { X } from "lucide-react";

import { ChatThinking } from "@/components/chat/chat-loading";
import { cn } from "@/lib/utils";

export function StrataShellStatusFooter({
  actionStatus,
  onDismissStatus,
  showThinking,
  variant = "block",
}: {
  actionStatus: { state: ActionStatusState; text: string };
  onDismissStatus: () => void;
  showThinking: boolean;
  variant?: "block" | "inline";
}) {
  const statusPill =
    actionStatus.state !== "idle" ? (
      <div
        className={cn(
          "group inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 transition-colors",
          actionStatus.state === "loading" && "border-border/50 bg-muted/20",
          actionStatus.state === "completed" &&
            "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400",
          actionStatus.state === "error" &&
            "border-destructive/40 bg-destructive/10 text-destructive"
        )}
      >
        <span
          className={cn(
            "truncate text-xs",
            actionStatus.state === "loading" &&
              "animate-pulse bg-linear-to-r from-muted-foreground/70 via-foreground/80 to-muted-foreground/70 bg-clip-text text-transparent"
          )}
        >
          {actionStatus.text}
        </span>
        {actionStatus.state === "completed" && (
          <button
            aria-label="Dismiss status"
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 opacity-0 transition-opacity group-hover:opacity-100 dark:text-emerald-300"
            type="button"
            onClick={onDismissStatus}
          >
            <X size={12} />
          </button>
        )}
      </div>
    ) : null;

  const thinkingSlot = (
    <div className="flex h-9 w-16 shrink-0 items-center justify-end text-muted-foreground">
      {showThinking ? <ChatThinking text="Working..." /> : null}
    </div>
  );

  if (variant === "inline") {
    return (
      <div
        className="inline-flex max-w-full min-w-0 items-center gap-2 text-xs"
        role="status"
        aria-live="polite"
      >
        <div
          className={cn(
            "flex min-h-9 min-w-0 items-center",
            actionStatus.state !== "idle" && "max-w-[min(14rem,42vw)] sm:max-w-xs"
          )}
        >
          {statusPill}
        </div>
        {thinkingSlot}
      </div>
    );
  }

  return (
    <div
      className="flex w-full min-h-10 shrink-0 items-center justify-between gap-2 text-xs"
      role="status"
      aria-live="polite"
    >
      <div className="flex min-h-9 min-w-0 flex-1 items-center">{statusPill}</div>
      {thinkingSlot}
    </div>
  );
}
