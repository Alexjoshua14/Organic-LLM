"use client";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

import {
  useChatStyleCardLumen,
  useChatStyleCardLumenHostRef,
} from "./use-chat-style-card-lumen";

type ChatStarterCardProps = {
  label: string;
  selected: boolean;
  onToggle: () => void;
};

export function ChatStarterCard({ label, selected, onToggle }: ChatStarterCardProps) {
  const hostRef = useChatStyleCardLumenHostRef();
  useChatStyleCardLumen(hostRef, selected);

  return (
    <span ref={hostRef} className="chat-style-card-host flex min-w-0 w-full overflow-visible">
      <span className="chat-style-card-stage relative flex min-w-0 w-full overflow-visible">
        {selected ? <span aria-hidden className="chat-style-lumen-rim" /> : null}
        <button
          aria-pressed={selected}
          className={cn(
            "chat-style-card line-clamp-2 relative z-10 w-full min-w-0 cursor-pointer rounded-lg border px-3 py-2 text-left text-xs leading-snug transition-[border-color,box-shadow,transform] duration-200 sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-sm",
            glass({ opaque: true }),
            "motion-safe:hover:translate-x-0.5 motion-safe:active:scale-[0.995]",
            selected
              ? "border-[color:rgb(var(--lumen-rim)/0.28)] text-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.14)]"
              : "border-border/50 text-foreground/90 hover:border-[color:rgb(var(--lumen-rim)/0.2)] hover:text-foreground"
          )}
          type="button"
          onClick={onToggle}
        >
          {label}
        </button>
      </span>
    </span>
  );
}
