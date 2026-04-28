"use client";

import type { Thread } from "@/lib/schemas/chat";
import type { UIMessage } from "ai";
import type { ParticleFieldVisualState } from "../_lib/types";
import type { LensPerfMetrics } from "./lens/LensPerfHud";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bug } from "lucide-react";
import { Button } from "@heroui/button";

import { useMemoryIngestSession } from "../_hooks/use-memory-ingest-session";
import {
  isMemoryIngestDevUiPublicFlag,
  readMemoryIngestDevUiFromSearch,
} from "../_lib/memory-ingest-dev-ui";
import { lastAssistantPlaintext } from "../_lib/memory-ingest-messages";

import { MemoryIngestDebugPanel } from "./MemoryIngestDebugPanel";
import { MemoryIngestParticleModeDevOverlay } from "./MemoryIngestParticleModeDevOverlay";
import { ParticleField } from "./ParticleField";

import Page from "@/components/layout/page";
import { CoreInput } from "@/components/chat/core-input";
import { PromptInputProvider } from "@/components/third-party/ai-elements/prompt-input";
import { cn } from "@/lib/utils";

type MemoryIngestShellProps = {
  chatData: { thread: Thread; messages: UIMessage[] };
};

export function MemoryIngestShell({ chatData }: MemoryIngestShellProps) {
  const inputWrapRef = useRef<HTMLDivElement>(null);
  const useSpeechFriendlyRef = useRef(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [devUiFromQuery, setDevUiFromQuery] = useState(false);
  const [perfMetrics, setPerfMetrics] = useState<LensPerfMetrics | null>(null);

  useEffect(() => {
    setDevUiFromQuery(readMemoryIngestDevUiFromSearch(window.location.search));
  }, []);

  const showPrototypeDevUi =
    process.env.NODE_ENV === "development" || isMemoryIngestDevUiPublicFlag() || devUiFromQuery;

  const {
    fsm,
    messages,
    particleRef,
    modelRef,
    useWebSearchRef,
    useMemoriesRef,
    sendIngest,
    setDraftListening,
    status,
    stop,
    error,
    clearError,
    debugSetVisual,
    debugPulseWriting,
  } = useMemoryIngestSession({
    chatId: chatData.thread.id,
    initialMessages: chatData.messages,
  });

  const assistantText = lastAssistantPlaintext(messages);

  const onComposerTextChange = useCallback(
    (t: string) => {
      setDraftListening(t.trim().length > 0);
    },
    [setDraftListening]
  );

  const sendMessage = useCallback(
    async (msg?: unknown) => {
      const text =
        msg &&
        typeof msg === "object" &&
        "text" in msg &&
        typeof (msg as { text?: string }).text === "string"
          ? (msg as { text: string }).text.trim()
          : "";

      if (!text) return undefined;
      await sendIngest(text);

      return undefined as never;
    },
    [sendIngest]
  );

  const onDebugSetVisual = useCallback(
    (v: ParticleFieldVisualState) => {
      debugSetVisual(v, 0.65);
    },
    [debugSetVisual]
  );

  const onPerfSample = useCallback((metrics: LensPerfMetrics) => {
    setPerfMetrics(metrics);
  }, []);

  return (
    <Page className="text-foreground">
      <div
        className={cn(
          "relative mx-auto flex min-h-dvh w-full max-w-full flex-col",
          "px-4 pb-[env(safe-area-inset-bottom)] pt-6 sm:px-6 md:px-8",
          "sm:max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-3xl"
        )}
      >
        <div className="flex flex-1 flex-col">
          <h1 className="sr-only">Memory ingest</h1>
          <div className="relative mx-auto flex w-full max-w-[min(100%,393px)] flex-1 flex-col items-center sm:max-w-full">
            <div
              className={cn(
                "relative w-full shrink-0",
                "h-[min(78vh,1080px)] sm:h-[min(80vh,1120px)] md:h-[min(82vh,1180px)] lg:h-[min(84vh,1240px)]",
                "max-w-[min(100%,1080px)] sm:max-w-[min(100%,1120px)] md:max-w-[min(100%,1180px)] lg:max-w-[min(100%,1240px)]"
              )}
            >
              <ParticleField
                ref={particleRef}
                className="rounded-2xl"
                devUiEnabled={showPrototypeDevUi}
                inputAnchorRef={inputWrapRef}
                intensity={fsm.intensity}
                onPerfSample={onPerfSample}
                state={fsm.visual}
              />
            </div>
            {assistantText ? (
              <p
                className={cn(
                  "text-muted-foreground mt-4 line-clamp-3 w-full text-center text-[15px] leading-snug",
                  "max-w-[min(100%,360px)] sm:max-w-md md:max-w-lg md:text-base lg:max-w-xl"
                )}
                data-testid="memory-ingest-assistant-text"
              >
                {assistantText}
              </p>
            ) : (
              <div className="mt-4 h-[4.5rem]" aria-hidden />
            )}
          </div>
        </div>

        <div
          ref={inputWrapRef}
          className="sticky bottom-0 z-10 w-full max-w-full px-0 pb-3 pt-2 sm:pb-4"
        >
          <PromptInputProvider>
            <CoreInput
              chatId={chatData.thread.id}
              className="border-border bg-card/80 backdrop-blur-sm"
              clearError={clearError}
              error={error}
              modelRef={modelRef}
              sendMessage={sendMessage as never}
              status={status}
              stop={stop}
              useMemoriesRef={useMemoriesRef}
              useSpeechFriendlyRef={useSpeechFriendlyRef}
              useWebSearchRef={useWebSearchRef}
              onComposerTextChange={onComposerTextChange}
            />
          </PromptInputProvider>
        </div>

        {showPrototypeDevUi ? (
          <>
            <MemoryIngestParticleModeDevOverlay
              visual={fsm.visual}
              onPulseWriting={debugPulseWriting}
              onSetVisual={onDebugSetVisual}
            />
            <Button
              isIconOnly
              aria-label="Open particle debug"
              className="fixed bottom-40 right-3 z-[55] h-10 w-10 min-w-0 border border-border bg-muted/90 text-muted-foreground sm:right-6 md:right-8"
              radius="full"
              size="sm"
              variant="flat"
              onPress={() => setDebugOpen((o) => !o)}
            >
              <Bug className="h-4 w-4" />
            </Button>
            <MemoryIngestDebugPanel
              metrics={perfMetrics}
              open={debugOpen}
              onClose={() => setDebugOpen(false)}
              onPulseWriting={debugPulseWriting}
              onSetVisual={onDebugSetVisual}
            />
          </>
        ) : null}
      </div>
    </Page>
  );
}
