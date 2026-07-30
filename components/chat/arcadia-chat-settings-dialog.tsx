"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { glass } from "@/components/design-system/primitives";
import { Button } from "@/components/third-party/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/third-party/ui/dialog";
import { useSharedChatContext } from "@/lib/context/chat-context";
import { useResolvedThreadTitle } from "@/components/chat/chat-thread-title-overlay";
import { cn } from "@/lib/utils";

const ARCADIA_TITLE_CLASS =
  "bg-linear-to-tr from-emerald-600/90 via-emerald-700/80 to-foreground bg-clip-text text-transparent";

type RegenerateButtonStatus = "idle" | "loading" | "completed";

type ArcadiaChatSettingsDialogProps = {
  chatId: string;
  initialTitle: string | null | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type ThreadMeta = {
  title: string | null;
  summary: string | null;
};

function RegenerateAiButton({
  idleLabel,
  loadingLabel,
  disabled,
  status,
  onClick,
}: {
  idleLabel: string;
  loadingLabel: string;
  disabled?: boolean;
  status: RegenerateButtonStatus;
  onClick: () => void;
}) {
  const isLoading = status === "loading";
  const isCompleted = status === "completed";

  return (
    <Button
      className="h-auto min-h-9 w-full flex-col gap-1 px-3 py-2"
      disabled={disabled || isLoading}
      size="sm"
      type="button"
      variant="outline"
      onClick={onClick}
    >
      {isLoading ? (
        <>
          <Loader2 aria-hidden className="size-4 animate-spin" />
          <span className="text-2xs leading-none text-muted-foreground">{loadingLabel}</span>
        </>
      ) : isCompleted ? (
        <span className="text-sm">Completed</span>
      ) : (
        <>
          <Sparkles aria-hidden className="size-4" />
          <span className="text-sm">{idleLabel}</span>
        </>
      )}
    </Button>
  );
}

export function ArcadiaChatSettingsDialog({
  chatId,
  initialTitle,
  open,
  onOpenChange,
}: ArcadiaChatSettingsDialogProps) {
  const { refreshSidebarChats } = useSharedChatContext();
  const resolvedTitle = useResolvedThreadTitle(chatId, initialTitle);
  const [meta, setMeta] = useState<ThreadMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [titleStatus, setTitleStatus] = useState<RegenerateButtonStatus>("idle");
  const [summaryStatus, setSummaryStatus] = useState<RegenerateButtonStatus>("idle");
  const titleResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const summaryResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayTitle = meta?.title ?? resolvedTitle ?? "Untitled chat";
  const displaySummary = meta?.summary?.trim() ? meta.summary : "No conversation summary yet.";

  const clearTimers = useCallback(() => {
    if (titleResetTimerRef.current) {
      clearTimeout(titleResetTimerRef.current);
      titleResetTimerRef.current = null;
    }

    if (summaryResetTimerRef.current) {
      clearTimeout(summaryResetTimerRef.current);
      summaryResetTimerRef.current = null;
    }
  }, []);

  const scheduleStatusReset = useCallback(
    (kind: "title" | "summary") => {
      const timerRef = kind === "title" ? titleResetTimerRef : summaryResetTimerRef;
      const setStatus = kind === "title" ? setTitleStatus : setSummaryStatus;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        setStatus("idle");
        timerRef.current = null;
      }, 3000);
    },
    []
  );

  const loadMeta = useCallback(async () => {
    if (!chatId) return;

    setMetaLoading(true);

    try {
      const res = await fetch(`/api/chat/${chatId}/arcadia/thread-meta`);

      if (!res.ok) {
        throw new Error(`Failed to load thread meta (${res.status})`);
      }

      const body = (await res.json()) as { data?: ThreadMeta };
      setMeta(body.data ?? { title: null, summary: null });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load chat settings");
    } finally {
      setMetaLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    if (!open) {
      clearTimers();
      setTitleStatus("idle");
      setSummaryStatus("idle");

      return;
    }

    void loadMeta();
  }, [open, loadMeta, clearTimers]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const runRegeneration = useCallback(
    async (kind: "title" | "summary") => {
      const setStatus = kind === "title" ? setTitleStatus : setSummaryStatus;
      const endpoint =
        kind === "title"
          ? `/api/chat/${chatId}/arcadia/regenerate-title`
          : `/api/chat/${chatId}/arcadia/regenerate-summary`;

      setStatus("loading");

      try {
        const res = await fetch(endpoint, { method: "POST" });
        const body = (await res.json().catch(() => ({}))) as { data?: string; error?: string };

        if (!res.ok) {
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }

        if (kind === "title") {
          setMeta((prev) => ({
            title: body.data?.trim() || prev?.title || null,
            summary: prev?.summary ?? null,
          }));
          refreshSidebarChats();
        } else {
          setMeta((prev) => ({
            title: prev?.title ?? null,
            summary: body.data?.trim() || prev?.summary || null,
          }));
        }

        setStatus("completed");
        scheduleStatusReset(kind);
      } catch (error) {
        setStatus("idle");
        toast.error(error instanceof Error ? error.message : "Regeneration failed");
      }
    },
    [chatId, refreshSidebarChats, scheduleStatusReset]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(90dvh,640px)] w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden border-0 bg-transparent p-0 shadow-none sm:max-w-lg"
        overlayClassName="bg-black/25 backdrop-blur-sm dark:bg-black/60"
      >
        <div
          className={cn(
            glass({ opaque: true }),
            "flex max-h-[min(90dvh,640px)] flex-col overflow-hidden rounded-2xl",
            "shadow-[0_24px_80px_-32px_rgba(0,0,0,0.45)]",
            "ring-1 ring-inset ring-white/25 dark:ring-white/10"
          )}
        >
          <DialogHeader className="space-y-1 border-b border-border/40 px-5 py-4 text-center sm:text-center">
            <DialogTitle className="sr-only">Chat settings</DialogTitle>
            <DialogDescription className="sr-only">
              View chat title and summary, or regenerate them with AI.
            </DialogDescription>
            <h2
              className={cn(
                "text-lg font-semibold leading-tight tracking-tight text-foreground md:text-xl",
                ARCADIA_TITLE_CLASS
              )}
            >
              {displayTitle}
            </h2>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
            <section className="space-y-2 text-center">
              <h3 className="text-sm font-medium tracking-tight text-foreground">Summary</h3>
              <p
                className={cn(
                  "mx-auto max-w-prose text-sm leading-relaxed text-foreground/85",
                  metaLoading && "animate-pulse text-muted-foreground"
                )}
              >
                {metaLoading ? "Loading summary…" : displaySummary}
              </p>
            </section>

            <div className="grid gap-2 sm:grid-cols-2">
              <RegenerateAiButton
                idleLabel="Regenerate title (AI)"
                loadingLabel="Regenerating title…"
                status={titleStatus}
                onClick={() => void runRegeneration("title")}
              />
              <RegenerateAiButton
                idleLabel="Regenerate summary (AI)"
                loadingLabel="Regenerating summary…"
                status={summaryStatus}
                onClick={() => void runRegeneration("summary")}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
