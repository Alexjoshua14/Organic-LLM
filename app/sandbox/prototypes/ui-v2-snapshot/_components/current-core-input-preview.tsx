"use client";

import type { ComponentProps } from "react";

import { useMemo, useRef } from "react";

import { CoreInput } from "@/components/chat/core-input";
import { glassPreview } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";
import { DEFAULT_CHAT_MODEL, type ChatModel } from "@/lib/schemas/chat";

type CoreInputProps = ComponentProps<typeof CoreInput>;

/** Same `glassPreview` material as Organic Glass Stable 2.0, scoped onto CoreInput’s shell. */
const V2_CORE_INPUT_GLASS_SCOPED = glassPreview({ depth: "floating", interactive: true })
  .split(/\s+/)
  .filter(Boolean)
  .map((c) => `[&_form>div]:${c}`);

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
        variant === "v2" && [
          "[&_form>div]:rounded-2xl",
          ...V2_CORE_INPUT_GLASS_SCOPED,
          "[&_[data-slot=input-group-addon]]:gap-0.5 [&_[data-slot=input-group-addon]>div]:gap-0.5 [&_[data-slot=input-group-addon]_button]:px-1.5 [&_[data-slot=input-group-addon]_button]:sm:px-2",
        ]
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
