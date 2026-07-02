"use client";

import { ChefHat, LayoutGrid, MessagesSquare, NotebookPen } from "lucide-react";

import { glass } from "@/components/design-system/primitives";
import { type ChatStyle, resolveChatStyleMeta } from "@/lib/chat/chat-style";
import { useChatStyle } from "@/lib/chat/chat-style-store";
import { cn } from "@/lib/utils";

const STYLE_ICONS: Record<ChatStyle, React.ReactNode> = {
  default: <MessagesSquare aria-hidden className="size-3.5 shrink-0" />,
  ergon: <LayoutGrid aria-hidden className="size-3.5 shrink-0" />,
  remy: <ChefHat aria-hidden className="size-3.5 shrink-0" />,
  scribe: <NotebookPen aria-hidden className="size-3.5 shrink-0" />,
};

type ChatThreadStyleOverlayProps = {
  threadId: string;
  /** Hide while the empty-state style picker is the primary affordance. */
  visible?: boolean;
  className?: string;
};

/**
 * Floating Arcadia thread-style pill (Standard / Ergon / Scribe) so active threads
 * stay identifiable after the empty-state picker scrolls away.
 */
export function ChatThreadStyleOverlay({
  threadId,
  visible = true,
  className,
}: ChatThreadStyleOverlayProps) {
  const style = useChatStyle(threadId);
  const meta = resolveChatStyleMeta(style);

  if (!visible || !threadId) return null;

  return (
    <div
      aria-hidden={false}
      className={cn(
        "pointer-events-none absolute z-20",
        "top-[max(1rem,env(safe-area-inset-top,0px))] md:top-4",
        "left-1/2 -translate-x-1/2",
        className
      )}
    >
      <div
        className={cn(
          glass({ opaque: true }),
          "pointer-events-auto flex max-w-[min(16rem,calc(100vw-8rem))] items-center gap-1.5",
          "rounded-full px-3 py-1.5",
          "shadow-[0_12px_44px_-26px_rgba(0,0,0,0.4)]",
          "ring-1 ring-inset ring-white/25 dark:ring-white/10"
        )}
      >
        <span className="text-muted-foreground">{STYLE_ICONS[style]}</span>
        <p className="truncate text-[11px] font-medium leading-none text-muted-foreground">
          <span className="sr-only">Thread style: </span>
          {meta.label}
        </p>
      </div>
    </div>
  );
}
