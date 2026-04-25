"use client";

import type { ComponentProps } from "react";

import { useMemo, useRef } from "react";

import { CoreInput } from "@/components/chat/core-input";
import { DEFAULT_CHAT_MODEL, type ChatModel } from "@/lib/schemas/chat";

type CoreInputProps = ComponentProps<typeof CoreInput>;

export function CurrentCoreInputPreview() {
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
      className="relative z-0 w-full min-w-0 [&_form]:w-full"
      clearError={handlers.clearError}
      modelRef={modelRef}
      sendMessage={handlers.sendMessage}
      status="ready"
      stop={handlers.stop}
      useMemoriesRef={useMemoriesRef}
      useSpeechFriendlyRef={useSpeechFriendlyRef}
      useWebSearchRef={useWebSearchRef}
    />
  );
}
