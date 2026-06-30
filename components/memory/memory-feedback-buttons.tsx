"use client";

import { useCallback, useState, useTransition } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";

import { actionRecordMemoryFeedback } from "@/app/actions/memory-feedback";
import type { MemoryFeedbackSource } from "@/lib/schemas/memory-quality";
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
  const [signal, setSignal] = useState<"up" | "down" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    (next: "up" | "down") => {
      setError(null);
      startTransition(async () => {
        const result = await actionRecordMemoryFeedback({
          memoryId,
          signal: next,
          source,
        });

        if (result.error) {
          setError(result.error);

          return;
        }
        setSignal(next);
      });
    },
    [memoryId, source]
  );

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <button
        aria-label="Good memory"
        aria-pressed={signal === "up"}
        className={cn(
          "rounded-lg transition-colors",
          compact ? "p-1" : "px-2 py-1",
          signal === "up"
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400"
        )}
        disabled={pending}
        type="button"
        onClick={() => submit("up")}
      >
        <ThumbsUp className={compact ? "size-3.5" : "size-4"} />
      </button>
      <button
        aria-label="Bad memory"
        aria-pressed={signal === "down"}
        className={cn(
          "rounded-lg transition-colors",
          compact ? "p-1" : "px-2 py-1",
          signal === "down"
            ? "text-destructive"
            : "text-muted-foreground hover:text-destructive"
        )}
        disabled={pending}
        type="button"
        onClick={() => submit("down")}
      >
        <ThumbsDown className={compact ? "size-3.5" : "size-4"} />
      </button>
      {error ? <span className="text-[10px] text-destructive">{error}</span> : null}
    </div>
  );
}
