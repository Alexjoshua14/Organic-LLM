"use client";

import type { VoiceScreenContextSnapshot } from "@/hooks/use-realtime-voice";

import { Eye } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/third-party/ui/tooltip";

/**
 * **Dev only.** What the voice model was last told about the screen — the label on the bar, the
 * exact pushed text on hover, and why when there was nothing to describe.
 *
 * It exists to answer "does voice know what I have open?" without guessing. A user-facing version
 * waits on the private-thread decisions, which decide what it should show.
 */
export function VoiceSeesChip({ context }: { context: VoiceScreenContextSnapshot | null }) {
  const label = context?.label ?? "nothing yet";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label={`Voice sees: ${label}`}
          className="relative flex min-w-0 max-w-44 shrink items-center gap-1 rounded-full px-1.5 py-0.5 text-2xs text-muted-foreground transition-colors hover:text-foreground"
          data-voice-sees=""
          type="button"
        >
          <Eye aria-hidden="true" className="size-3 shrink-0" />
          <span className="truncate">{label}</span>
          {context?.reason ? (
            <span className="shrink-0 text-amber-400">· {context.reason}</span>
          ) : null}
        </button>
      </TooltipTrigger>
      <TooltipContent
        className="max-h-80 max-w-md overflow-y-auto whitespace-pre-wrap text-left font-mono text-2xs"
        side="top"
      >
        {context
          ? `${context.body}\n\n— ${context.surfaceKey} · ${context.body.length} chars`
          : "Nothing has been pushed to the model yet."}
      </TooltipContent>
    </Tooltip>
  );
}
