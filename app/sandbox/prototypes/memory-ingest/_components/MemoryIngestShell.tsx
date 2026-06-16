"use client";

import type { Thread } from "@/lib/schemas/chat";
import type { UIMessage } from "ai";
import type { ParticleFieldVisualState } from "../_lib/types";
import type { LensPerfMetrics } from "./lens/LensPerfHud";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bug } from "lucide-react";
import { Button } from "@heroui/button";

import { useMemoryIngestSession } from "../_hooks/use-memory-ingest-session";
import {
  isMemoryIngestDevUiPublicFlag,
  readMemoryIngestDevUiFromSearch,
} from "../_lib/memory-ingest-dev-ui";
import { memoryIngestDockBandHeightClass } from "../_lib/memory-ingest-layout";
import { lastAssistantPlaintext } from "../_lib/memory-ingest-messages";

import { MemoryIngestDebugPanel } from "./MemoryIngestDebugPanel";
import { MemoryIngestParticleModeDevOverlay } from "./MemoryIngestParticleModeDevOverlay";
import { ParticleField } from "./ParticleField";

import Page from "@/components/layout/page";
import { ChatMessageMarkdown } from "@/components/chat/chat-message-markdown";
import { CoreInput } from "@/components/chat/core-input";
import { PromptInputProvider } from "@/components/third-party/ai-elements/prompt-input";
import { cn } from "@/lib/utils";

/** TEMP: set true to outline particle column / field / caption slot. */
const MEMORY_INGEST_LAYOUT_DEBUG_OUTLINES = false;

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
  /** Shown under particles until real assistant text streams in (UI sample). */
  const assistantCaptionPlaceholder = "Here. Where would you like to start?";
  const assistantCaptionText = assistantText.trim() || assistantCaptionPlaceholder;

  const assistantMarkdownId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return messages[i].id;
    }

    return "memory-ingest-assistant-caption";
  }, [messages]);

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
          "relative mx-auto flex h-dvh min-h-0 w-full max-w-full flex-col",
          "px-4 pb-[env(safe-area-inset-bottom)] pt-6 sm:px-6 md:px-8",
          "sm:max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-3xl"
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <h1 className="sr-only">Memory ingest</h1>
          <div
            className={cn(
              "relative mx-auto flex w-full max-w-[min(100%,393px)] min-h-0 flex-1 flex-col items-center justify-start sm:max-w-full",
              MEMORY_INGEST_LAYOUT_DEBUG_OUTLINES &&
                "outline outline-2 -outline-offset-1 outline-dashed outline-amber-500"
            )}
          >
            <div
              className={cn(
                "relative w-full min-h-0 flex-1",
                "max-h-[min(78vh,1080px)] sm:max-h-[min(80vh,1120px)] md:max-h-[min(82vh,1180px)] lg:max-h-[min(84vh,1240px)]",
                "max-w-[min(100%,1080px)] sm:max-w-[min(100%,1120px)] md:max-w-[min(100%,1180px)] lg:max-w-[min(100%,1240px)]",
                MEMORY_INGEST_LAYOUT_DEBUG_OUTLINES &&
                  "outline outline-2 -outline-offset-1 outline-dashed outline-sky-500"
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
            <div
              className={cn(
                "mb-2 mt-2 w-full max-w-[min(100%,360px)] shrink-0 self-center overflow-x-hidden overflow-y-auto overscroll-y-contain sm:max-w-md md:max-w-lg lg:max-w-xl",
                "min-h-[calc(0.9375rem*1.375*4)] max-h-[calc(0.9375rem*1.375*4)] md:min-h-[calc(1rem*1.375*4)] md:max-h-[calc(1rem*1.375*4)]",
                MEMORY_INGEST_LAYOUT_DEBUG_OUTLINES &&
                  "outline outline-2 -outline-offset-1 outline-dashed outline-fuchsia-500"
              )}
              data-testid="memory-ingest-assistant-text"
            >
              <div
                className={cn(
                  "ai-message prose prose-sm max-w-full text-left text-foreground dark:prose-invert",
                  "leading-snug prose-headings:my-1 prose-headings:leading-snug",
                  "prose-p:my-1 prose-p:leading-snug prose-li:leading-snug",
                  "prose-ul:my-1 prose-ol:my-1"
                )}
              >
                <ChatMessageMarkdown
                  content={assistantCaptionText}
                  id={assistantMarkdownId}
                  wrapCodeBlocks
                />
              </div>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "sticky bottom-0 z-10 box-border flex w-full max-w-full min-h-0 shrink-0 flex-col justify-end overflow-x-hidden pt-1 pb-3 sm:pb-4",
            memoryIngestDockBandHeightClass
          )}
        >
          <div ref={inputWrapRef} className="w-full min-w-0 shrink-0">
            <PromptInputProvider>
              <CoreInput
                chatId={chatData.thread.id}
                className="border-border bg-card/80 backdrop-blur-sm"
                clearError={clearError}
                error={error}
                modelLocalStorageKey="organic-llm-selected-model-delphi"
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
