"use client";

import { useMemo } from "react";

import { glass } from "@/components/design-system/primitives";
import { FeatureHint } from "@/components/onboarding/feature-hint";
import { useSidebar } from "@/components/third-party/ui/sidebar";
import { useSharedChatContext } from "@/lib/context/chat-context";
import { cn } from "@/lib/utils";

type ChatThreadTitleOverlayProps = {
  title: string | null | undefined;
  className?: string;
};

export function useResolvedThreadTitle(
  threadId: string,
  initialTitle: string | null | undefined
): string | null {
  const { sidebarChats } = useSharedChatContext();

  return useMemo(() => {
    const row = sidebarChats.find((chat) => chat.id === threadId);
    const candidate = row?.hasNoTitle ? initialTitle : (row?.title ?? initialTitle);
    const trimmed = candidate?.trim() ?? "";

    if (!trimmed || trimmed === "Unknown title") return null;

    return trimmed;
  }, [initialTitle, sidebarChats, threadId]);
}

/**
 * Floating thread title for chat surfaces when the sidebar is collapsed on desktop.
 * Sits above the scroll layer so context stays visible without opening the nav.
 */
export function ChatThreadTitleOverlay({ title, className }: ChatThreadTitleOverlayProps) {
  const { open, isMobile } = useSidebar();
  const label = title?.trim();

  if (isMobile || open || !label) return null;

  return (
    <div
      aria-hidden={false}
      className={cn(
        "pointer-events-none absolute z-20",
        "top-[max(1rem,env(safe-area-inset-top,0px))] md:top-4",
        "left-14 md:left-16",
        className
      )}
    >
      <FeatureHint id="noesis-thread-title">
        <div
          className={cn(
            glass({ opaque: true }),
            "pointer-events-auto max-w-[min(18rem,calc(100vw-6rem))]",
            "rounded-lg px-3.5 py-2",
            "shadow-[0_12px_44px_-26px_rgba(0,0,0,0.4)]",
            "ring-1 ring-inset ring-white/25 dark:ring-white/10"
          )}
        >
          <h1 className="truncate text-[0.9375rem] font-semibold leading-snug tracking-tight text-foreground md:text-base">
            {label}
          </h1>
        </div>
      </FeatureHint>
    </div>
  );
}
