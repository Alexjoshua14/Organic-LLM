"use client";

import type { ComponentProps } from "react";

import { useMemo, useRef } from "react";

import { CoreInput } from "@/components/chat/core-input";
import { cn } from "@/lib/utils";
import { DEFAULT_CHAT_MODEL, type ChatModel } from "@/lib/schemas/chat";

type CoreInputProps = ComponentProps<typeof CoreInput>;

export function CurrentCoreInputPreview({ variant = "current" }: { variant?: "current" | "v2" }) {
  const modelRef = useRef<ChatModel>(DEFAULT_CHAT_MODEL);
  const useWebSearchRef = useRef(false);
  const useMemoriesRef = useRef(true);
  const useSpeechFriendlyRef = useRef(false);

  const handlers = useMemo(
    () => ({
      sendMessage: (async () => undefined) as CoreInputProps["sendMessage"],
      stop: (async () => undefined) as CoreInputProps["stop"],
      clearError: (() => undefined) as NonNullable<CoreInputProps["clearError"]>,
    }),
    []
  );

  return (
    <CoreInput
      className={cn(
        "relative z-0 w-full min-w-0 [&_form]:w-full",
        variant === "v2" &&
          "[&_form>div]:organic-glass-preview [&_form>div]:rounded-2xl [&_form>div]:border-white/20 [&_form>div]:bg-linear-to-br [&_form>div]:from-background/86 [&_form>div]:via-background/60 [&_form>div]:to-background-tertiary/42 [&_form>div]:shadow-[0_18px_60px_-32px_rgba(20,21,22,0.55),inset_0_1px_0_rgba(255,255,255,0.42)] [&_[data-slot=input-group-addon]]:gap-0.5 [&_[data-slot=input-group-addon]>div]:gap-0.5 [&_[data-slot=input-group-addon]_button]:px-1.5 [&_[data-slot=input-group-addon]_button]:sm:px-2 dark:[&_form>div]:from-background-secondary/82 dark:[&_form>div]:via-background/62 dark:[&_form>div]:to-background-tertiary/38"
      )}
      clearError={handlers.clearError}
      initialDraft={
        variant === "v2"
          ? "Ask anything. I can search, remember, reason, and connect what we know."
          : undefined
      }
      modelRef={modelRef}
      sendMessage={handlers.sendMessage}
      status="ready"
      stop={handlers.stop}
      submitVariant={variant === "v2" ? "organic-glass" : "default"}
      useMemoriesRef={useMemoriesRef}
      useSpeechFriendlyRef={useSpeechFriendlyRef}
      useWebSearchRef={useWebSearchRef}
    />
  );
}
