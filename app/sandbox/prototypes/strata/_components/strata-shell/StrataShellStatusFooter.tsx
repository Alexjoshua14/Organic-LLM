"use client";

import type { ActionStatusState } from "./strata-shell-model";

import { X } from "lucide-react";

import { ChatThinking } from "@/components/chat/chat-loading";
import { cn } from "@/lib/utils";

export function StrataShellStatusFooter({
  actionStatus,
  onDismissStatus,
  showThinking,
}: {
  actionStatus: { state: ActionStatusState; text: string };
  onDismissStatus: () => void;
  showThinking: boolean;
}) {
  return (
    <footer className="mx-auto flex w-full max-w-3xl shrink-0 items-center justify-between gap-2 px-3 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] text-xs sm:px-6">
      {actionStatus.state !== "idle" ? (
        <div
          className={cn(
            "group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 transition-colors",
            actionStatus.state === "loading" && "border-border/50 bg-muted/20",
            actionStatus.state === "completed" &&
              "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400",
            actionStatus.state === "error" &&
              "border-destructive/40 bg-destructive/10 text-destructive"
          )}
        >
          <span
            className={cn(
              "text-xs",
              actionStatus.state === "loading" &&
                "animate-pulse bg-linear-to-r from-muted-foreground/70 via-foreground/80 to-muted-foreground/70 bg-clip-text text-transparent"
            )}
          >
            {actionStatus.text}
          </span>
          {actionStatus.state === "completed" && (
            <button
              aria-label="Dismiss status"
              className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 opacity-0 transition-opacity group-hover:opacity-100 dark:text-emerald-300"
              type="button"
              onClick={onDismissStatus}
            >
              <X size={12} />
            </button>
          )}
        </div>
      ) : (
        <span className="text-muted-foreground" />
      )}
      {showThinking && (
        <div className="w-16 text-muted-foreground">
          <ChatThinking text="Working..." />
        </div>
      )}
    </footer>
  );
}
