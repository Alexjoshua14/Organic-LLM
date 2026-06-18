"use client";

import type { ReactNode } from "react";
import { Pin, PinOff } from "lucide-react";

import { cn } from "@/lib/utils";

type ToolResultPinButtonProps = {
  isPinned: boolean;
  onTogglePin: () => void;
  showPin?: boolean;
};

export function ToolResultPinButton({
  isPinned,
  onTogglePin,
  showPin = true,
}: ToolResultPinButtonProps) {
  if (!showPin) {
    return null;
  }

  return (
    <button
      aria-label={isPinned ? "Unpin tool output" : "Pin tool output"}
      aria-pressed={isPinned}
      className={cn(
        "h-6 w-6 shrink-0 grid place-content-center rounded text-muted-foreground",
        "hover:bg-background-tertiary/60 hover:text-foreground transition-colors",
      )}
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onTogglePin();
      }}
    >
      {isPinned ? <PinOff className="size-3" /> : <Pin className="size-3" />}
    </button>
  );
}

type ToolResultInlineRowProps = {
  isPinned?: boolean;
  pin?: ReactNode;
  children: ReactNode;
};

export function ToolResultInlineRow({ isPinned, pin, children }: ToolResultInlineRowProps) {
  return (
    <div
      className={cn("not-prose flex items-start gap-1.5", isPinned && "sticky top-20 z-30")}
    >
      {children}
      {pin}
    </div>
  );
}

export const toolResultSummaryButtonClass =
  "not-prose min-w-0 flex-1 cursor-pointer text-left text-xs text-muted-foreground";

export const toolResultErrorSummaryButtonClass =
  "min-w-0 flex-1 cursor-pointer text-left text-xs";

export const toolResultExpandedDetailClass = "mt-0.5 block text-[10px] leading-snug";
