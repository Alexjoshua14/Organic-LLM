"use client";

import type { ComponentProps } from "react";

import { ArrowDownIcon } from "lucide-react";
import { useCallback, useSyncExternalStore } from "react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";

import { cn } from "@/lib/utils";
import { Button } from "@/components/third-party/ui/button";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void) {
  const media = window.matchMedia?.(REDUCED_MOTION_QUERY);

  media?.addEventListener("change", onChange);

  return () => media?.removeEventListener("change", onChange);
}

function readReducedMotion() {
  return window.matchMedia?.(REDUCED_MOTION_QUERY).matches === true;
}

function useConversationReducedMotion() {
  return useSyncExternalStore(subscribeToReducedMotion, readReducedMotion, () => false);
}

export type ConversationProps = ComponentProps<typeof StickToBottom>;

export const Conversation = ({
  className,
  initial = "instant",
  resize = "smooth",
  ...props
}: ConversationProps) => {
  const reduceMotion = useConversationReducedMotion();

  return (
    <StickToBottom
      className={cn("relative flex-1 overflow-y-hidden", className)}
      initial={reduceMotion && initial !== false ? "instant" : initial}
      resize={reduceMotion ? "instant" : resize}
      role="log"
      {...props}
    />
  );
};

export type ConversationContentProps = ComponentProps<typeof StickToBottom.Content>;

export const ConversationContent = ({
  className,
  scrollClassName,
  ...props
}: ConversationContentProps) => (
  <StickToBottom.Content
    className={cn("flex flex-col gap-8 p-4 w-full", className)}
    scrollClassName={cn("conversation-scroll", scrollClassName)}
    {...props}
  />
);

export type ConversationEmptyStateProps = ComponentProps<"div"> & {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
};

export const ConversationEmptyState = ({
  className,
  title = "No messages yet",
  description = "Start a conversation to see messages here",
  icon,
  children,
  ...props
}: ConversationEmptyStateProps) => (
  <div
    className={cn(
      "flex size-full flex-col items-center justify-center gap-3 p-8 text-center",
      className
    )}
    {...props}
  >
    {children ?? (
      <>
        {icon && <div className="text-muted-foreground">{icon}</div>}
        <div className="space-y-1">
          <h3 className="font-medium text-sm">{title}</h3>
          {description && <p className="text-muted-foreground text-sm">{description}</p>}
        </div>
      </>
    )}
  </div>
);

export type ConversationScrollButtonProps = ComponentProps<typeof Button>;

export const ConversationScrollButton = ({
  className,
  ...props
}: ConversationScrollButtonProps) => {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();
  const reduceMotion = useConversationReducedMotion();

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom(reduceMotion ? { animation: "instant" } : undefined);
  }, [reduceMotion, scrollToBottom]);

  return (
    !isAtBottom && (
      <Button
        aria-label="Scroll to latest message"
        className={cn("absolute bottom-4 left-[50%] translate-x-[-50%] rounded-full", className)}
        size="icon"
        type="button"
        variant="outline"
        onClick={handleScrollToBottom}
        {...props}
      >
        <ArrowDownIcon aria-hidden="true" className="size-4" />
      </Button>
    )
  );
};
