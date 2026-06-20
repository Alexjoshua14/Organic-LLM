"use client";

import type { ReactNode } from "react";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

import {
  useChatStyleCardLumen,
  useChatStyleCardLumenHostRef,
} from "./use-chat-style-card-lumen";

type ChatStyleCardProps = {
  icon: ReactNode;
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
};

export function ChatStyleCard({
  icon,
  label,
  description,
  selected,
  onSelect,
}: ChatStyleCardProps) {
  const hostRef = useChatStyleCardLumenHostRef();
  useChatStyleCardLumen(hostRef, selected);

  return (
    <span ref={hostRef} className="chat-style-card-host flex h-full min-w-0 w-full overflow-visible">
      <span className="chat-style-card-stage relative flex h-full min-w-0 w-full overflow-visible">
        {selected ? <span aria-hidden className="chat-style-lumen-rim" /> : null}
        <button
          aria-checked={selected}
          className={cn(
            "chat-style-card group relative z-10 flex h-full min-h-0 min-w-0 w-full cursor-pointer flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-[border-color,box-shadow,transform] duration-200 sm:gap-2 sm:p-3.5",
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
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-background-tertiary/50 text-foreground">
            {icon}
          </span>
          <span className="w-full min-w-0 text-left text-sm font-medium leading-tight text-foreground">
            {label}
          </span>
          <span className="line-clamp-3 w-full min-w-0 break-words text-left text-[11px] leading-snug text-muted-foreground sm:text-xs">
            {description}
          </span>
        </button>
      </span>
    </span>
  );
}
