"use client";

import type { MemoryFeedbackRow, MemoryFeedbackSource } from "@/lib/schemas/memory-quality";

import { useEffect, useState, useTransition } from "react";
import { MessageSquare, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { Popover } from "radix-ui";

import { actionRecordMemoryFeedback } from "@/app/actions/memory-feedback";
import { glass } from "@/components/design-system/primitives";
import {
  MemoryFeedbackEditor,
  FEEDBACK_CHANGED_EVENT,
  announceFeedbackChange,
} from "@/components/memory/memory-feedback-editor";
import { cn } from "@/lib/utils";

type MemoryFeedbackButtonsProps = {
  memoryId: string;
  source?: MemoryFeedbackSource;
  className?: string;
  compact?: boolean;
};

export function MemoryFeedbackButtons({
  memoryId,
  source = "memory_lens",
  className,
  compact = false,
}: MemoryFeedbackButtonsProps) {
  const [pending, startTransition] = useTransition();
  const [row, setRow] = useState<MemoryFeedbackRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let controller: AbortController | null = null;
    const load = async () => {
      controller?.abort();
      const current = new AbortController();

      controller = current;
      try {
        const response = await fetch(
          `/api/memory/feedback?memoryId=${encodeURIComponent(memoryId)}`,
          { cache: "no-store", signal: current.signal }
        );

        if (!response.ok) throw new Error("Could not load feedback.");
        const data = await response.json();

        if (!current.signal.aborted) {
          setRow(data.row);
          setError(null);
        }
      } catch {
        if (!current.signal.aborted) setError("Feedback unavailable. Try voting again.");
      } finally {
        if (!current.signal.aborted) setLoaded(true);
      }
    };

    void load();
    window.addEventListener(FEEDBACK_CHANGED_EVENT, load);

    return () => {
      controller?.abort();
      window.removeEventListener(FEEDBACK_CHANGED_EVENT, load);
    };
  }, [memoryId, refresh]);

  function submit(signal: "up" | "down") {
    if (row?.signal === signal) {
      setOpen(true);
      setRefresh((value) => value + 1);

      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const result = await actionRecordMemoryFeedback({ memoryId, signal, source });

        if (result.error || !result.data) {
          setError(result.error ?? "Could not save feedback.");

          return;
        }
        setRow(result.data);
        setOpen(true);
        announceFeedbackChange();
      } catch {
        setError("Could not save feedback. Please try again.");
      }
    });
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setRefresh((value) => value + 1);
      }}
    >
      <Popover.Anchor asChild>
        <div className={cn("flex items-center gap-1", className)}>
          {(["up", "down"] as const).map((signal) => {
            const Icon = signal === "up" ? ThumbsUp : ThumbsDown;

            return (
              <button
                key={signal}
                aria-label={signal === "up" ? "Good memory" : "Bad memory"}
                aria-pressed={row?.signal === signal}
                className={cn(
                  "rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                  compact ? "p-1.5" : "px-2 py-1.5",
                  row?.signal === signal
                    ? signal === "up"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-destructive"
                    : "text-muted-foreground hover:text-foreground"
                )}
                disabled={pending || !loaded}
                title={
                  row?.note && row.signal !== signal
                    ? "Changing your vote removes the shared note"
                    : undefined
                }
                type="button"
                onClick={() => submit(signal)}
              >
                <Icon aria-hidden className={compact ? "size-3.5" : "size-4"} />
              </button>
            );
          })}
          {row && (
            <Popover.Trigger asChild>
              <button
                aria-label={row.note ? "Edit memory feedback note" : "Add memory feedback note"}
                className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                type="button"
              >
                <MessageSquare
                  aria-hidden
                  className={cn("size-3.5", row.note && "fill-current/15")}
                />
              </button>
            </Popover.Trigger>
          )}
          {error && (
            <span className="max-w-32 text-2xs text-destructive" role="alert">
              {error}
            </span>
          )}
        </div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          align="end"
          aria-label="Memory feedback"
          className={cn(
            glass({ opaque: true }),
            "z-[240] w-80 max-w-[calc(100vw-24px)] max-h-[min(80vh,var(--radix-popover-content-available-height))] overflow-y-auto rounded-xl p-4 shadow-xl"
          )}
          collisionPadding={12}
          sideOffset={8}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <Popover.Close
            aria-label="Close feedback"
            className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground hover:text-foreground"
          >
            <X aria-hidden className="size-4" />
          </Popover.Close>
          {row && (
            <MemoryFeedbackEditor
              key={`${row.id}:${row.signal}:${row.note_approved_at ?? ""}`}
              row={row}
              onClose={() => setOpen(false)}
              onSaved={setRow}
            />
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
