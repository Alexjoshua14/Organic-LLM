"use client";

import type { ReactNode } from "react";

import { glass } from "@/components/design-system/primitives";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/third-party/ui/tooltip";
import { cn } from "@/lib/utils";

import { useChatStyleCardLumen, useChatStyleCardLumenHostRef } from "./use-chat-style-card-lumen";

type ChatStyleCardProps = {
  icon: ReactNode;
  label: string;
  description: string;
  /** Hover tooltip — fuller guide than the card description. */
  guide?: string;
  selected: boolean;
  onSelect: () => void;
};

export function ChatStyleCard({
  icon,
  label,
  description,
  guide,
  selected,
  onSelect,
}: ChatStyleCardProps) {
  const hostRef = useChatStyleCardLumenHostRef();
  useChatStyleCardLumen(hostRef, selected);

  const cardButton = (
    <button
      aria-checked={selected}
      className={cn(
        "chat-style-card group relative z-10 grid grid-rows-[1fr_1fr_2fr] min-w-0 w-full h-full cursor-pointer flex-col items-start gap-1 rounded-xl border p-2 text-left transition-[border-color,box-shadow,transform] duration-200 sm:gap-1.5 sm:p-3",
        glass({ opaque: true }),
        "motion-safe:hover:scale-[1.01] motion-safe:active:scale-[0.99]",
        selected
          ? "border-[color:rgb(var(--lumen-rim)/0.28)] shadow-[inset_0_1px_0_rgb(255_255_255/0.14)]"
          : "border-border/50 hover:border-[color:rgb(var(--lumen-rim)/0.18)]"
      )}
      role="radio"
      type="button"
      onClick={onSelect}
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-background-tertiary/50 text-foreground sm:size-8">
        {icon}
      </span>
      <span className="w-full min-w-0 text-left text-xs font-medium leading-tight text-foreground sm:text-sm">
        {label}
      </span>
      <span className="line-clamp-3 w-full min-w-0 text-left text-[10px] leading-snug text-muted-foreground sm:text-xs">
        {description}
      </span>
    </button>
  );

  return (
    <span ref={hostRef} className="chat-style-card-host flex min-w-0 w-full overflow-visible">
      <span className="chat-style-card-stage relative flex min-w-0 w-full overflow-visible">
        {selected ? <span aria-hidden className="chat-style-lumen-rim" /> : null}
        {guide ? (
          <Tooltip>
            <TooltipTrigger asChild>{cardButton}</TooltipTrigger>
            <TooltipContent className="max-w-[15rem] text-xs leading-snug" side="top">
              {guide}
            </TooltipContent>
          </Tooltip>
        ) : (
          cardButton
        )}
      </span>
    </span>
  );
}
