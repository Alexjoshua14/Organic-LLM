"use client";

import type { UIMessage } from "ai";
import type { Thread } from "@/lib/schemas/chat";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { Chat } from "@/components/chat/chat";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/third-party/ui/sheet";
import { ensureRemyPlannerThread } from "@/lib/remy/planner-thread";
import { cn } from "@/lib/utils";

type ChatData = { thread: Thread; messages: UIMessage[] };

/** Slot scope from the week grid (“ask Remy”). Same shape as RemySlotPanel. */
export type RemyChatDockAskContext = {
  date?: string;
  slot?: string;
  recipeTitle?: string;
};

export type RemyChatDockProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefills the composer (overrides askContext). */
  initialDraft?: string;
  /** Empty-slot / filled-slot “Ask Remy” — date, slot, optional title. */
  askContext?: RemyChatDockAskContext | null;
};

function draftFromAskContext(ctx: RemyChatDockAskContext | null | undefined): string | undefined {
  if (!ctx?.date || !ctx.slot) return undefined;
  const meal = ctx.recipeTitle ? ` (${ctx.recipeTitle})` : "";

  return `Help me plan ${ctx.slot}${meal} on ${ctx.date}. Prefer leftovers and ingredients already on this week's list.`;
}

/**
 * Right-side Remy planner dock on `/remy`. First open creates or resumes the
 * dedicated `remy_planner` thread. Full-page threads remain at `/remy/[id]`.
 */
export function RemyChatDock({ open, onOpenChange, initialDraft, askContext }: RemyChatDockProps) {
  const [chatData, setChatData] = useState<ChatData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const composerDraft = useMemo(
    () => initialDraft?.trim() || draftFromAskContext(askContext),
    [initialDraft, askContext]
  );

  useEffect(() => {
    if (!open || chatData) return;

    let cancelled = false;

    setLoading(true);
    setError(null);
    void ensureRemyPlannerThread()
      .then((result) => {
        if (cancelled) return;

        if (!result.ok) {
          setError(result.error);
          setChatData(null);

          return;
        }

        setChatData(result.chatData);
      })
      .catch(() => {
        if (!cancelled) setError("Could not open Remy");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, chatData]);

  const threadId = chatData?.thread.id;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        overlayPriority
        className={cn("flex h-full w-full flex-col gap-0 border-l p-0 sm:max-w-md md:max-w-lg")}
        side="right"
      >
        <SheetHeader className="shrink-0 space-y-stack-xs border-b border-border/60 px-inset-md py-stack-md text-left">
          <SheetTitle className="font-commissioner text-lg font-light">Remy</SheetTitle>
          {threadId ? (
            <Link
              className="inline-flex items-center gap-inline-sm text-xs text-muted-foreground hover:text-foreground"
              href={`/remy/${threadId}`}
            >
              Open full thread
              <ExternalLink className="size-3" />
            </Link>
          ) : null}
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col">
          {error ? (
            <p className="px-inset-md py-stack-lg text-sm text-muted-foreground">{error}</p>
          ) : null}
          {loading && !chatData ? (
            <p className="px-inset-md py-stack-lg text-sm text-muted-foreground">
              Opening planner…
            </p>
          ) : null}
          {chatData ? (
            <Chat chatData={chatData} initialDraft={composerDraft} persona="remy" />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
