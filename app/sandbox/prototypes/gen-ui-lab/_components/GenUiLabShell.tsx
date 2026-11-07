"use client";

import type { ChatStatus } from "ai";
import type { ComponentProps } from "react";
import type { DecisionMatrixBlock, GenUIBlock } from "@/lib/schemas/gen-ui";

import { useCallback, useMemo, useRef, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";

import { useGenUiGalleryScroll } from "../_hooks/use-gen-ui-gallery-scroll";
import { useGenUiLabQuestion } from "../_hooks/use-gen-ui-lab-question";

import { GenUiGalleryNav } from "./GenUiGalleryNav";
import {
  GenUiDecisionDemo,
  GenUiDecisionDemoToolbar,
  useGenUiDecisionDemo,
} from "./GenUiDecisionDemo";
import { GenUiGallerySection } from "./GenUiGallerySection";
import { GEN_UI_LAB_STATES, GenUiLabStatePanel, type GenUiLabStateId } from "./GenUiLabStates";

import { GenUIRenderer } from "@/components/chat/gen-ui/GenUIRenderer";
import { GEN_UI_REGISTRY } from "@/components/chat/gen-ui/registry";
import { CoreInput } from "@/components/chat/core-input";
import { BtwPanel } from "@/components/chat/btw/btw-panel";
import { PageNavBack } from "@/components/layout/page-content-frame";
import { glass } from "@/components/design-system/primitives";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/third-party/ui/select";
import { ChatModel, DEFAULT_CHAT_MODEL } from "@/lib/schemas/chat";
import { GEN_UI_BLOCK_TYPES, type GenUIBlockType } from "@/lib/schemas/gen-ui/shared";
import {
  buildDefaultBlockMap,
  type GenUiLabApiResponse,
  type GenUiLabViewMode,
} from "@/lib/sandbox/gen-ui-lab";
import { cn } from "@/lib/utils";

type CoreInputProps = ComponentProps<typeof CoreInput>;

type GenUiLabShellProps = {
  initialBlocks: Record<GenUIBlockType, GenUIBlock>;
};

export function GenUiLabShell({ initialBlocks }: GenUiLabShellProps) {
  const [blocks, setBlocks] = useState(initialBlocks);
  const [selectedType, setSelectedType] = useState<GenUIBlockType>("restaurant-card");
  const [viewMode, setViewMode] = useState<GenUiLabViewMode>("gallery");
  // A rendering state (partial, invalid, streaming) takes over the panel until an archetype is picked.
  const [stateView, setStateView] = useState<GenUiLabStateId | null>(null);
  const galleryActive = viewMode === "gallery" && stateView == null;
  const decisionSelected = selectedType === "decision-matrix" && stateView == null;
  const decisionDemo = useGenUiDecisionDemo(decisionSelected);
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [aionMessage, setAionMessage] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const modelRef = useRef<ChatModel>(DEFAULT_CHAT_MODEL);
  const useWebSearchRef = useRef(false);
  const useMemoriesRef = useRef(false);

  const applyApiResponse = useCallback((response: GenUiLabApiResponse) => {
    if (response.selection) {
      setSelectedType(response.selection.blockType);
      setViewMode(response.selection.viewMode);
      setStateView(null);
    }

    if (response.generated) {
      setBlocks((prev) => ({
        ...prev,
        [response.generated!.blockType]: response.generated!.block,
      }));
      setSelectedType(response.generated.blockType);
      setViewMode("focus");
      setStateView(null);
    }
  }, []);

  const archetypeList = useMemo(() => {
    const entries = GEN_UI_BLOCK_TYPES.map((type) => ({
      type,
      label: GEN_UI_REGISTRY[type].label,
    }));

    const restaurantIndex = entries.findIndex((e) => e.type === "restaurant-card");

    if (restaurantIndex <= 0) return entries;

    const [restaurant, ...rest] = [
      entries[restaurantIndex]!,
      ...entries.slice(0, restaurantIndex),
      ...entries.slice(restaurantIndex + 1),
    ];

    return [restaurant, ...rest];
  }, []);

  const sectionTypes = useMemo(() => archetypeList.map((e) => e.type), [archetypeList]);

  const { scrollRef, registerSection, scrollToType, scrollToIndex, selectedIndex } =
    useGenUiGalleryScroll({
      enabled: galleryActive,
      sectionTypes,
      selectedType,
      onSelectType: setSelectedType,
    });

  const requestAion = useCallback(
    async (prompt: string, intent: "auto" | "generate" | "select", signal?: AbortSignal) => {
      const res = await fetch("/api/sandbox/gen-ui-lab", {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, selectedBlockType: selectedType, viewMode, intent }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;

        throw new Error(payload?.error ?? `Request failed (${res.status})`);
      }

      return (await res.json()) as GenUiLabApiResponse;
    },
    [selectedType, viewMode]
  );

  const runAion = useCallback(
    async (prompt: string, intent: "auto" | "generate" | "select" = "auto") => {
      setStatus("submitted");
      setError(null);

      try {
        const response = await requestAion(prompt, intent);

        applyApiResponse(response);
        setAionMessage(response.message);
        setStatus("ready");
      } catch (cause) {
        setError(cause instanceof Error ? cause : new Error(String(cause)));
        setStatus("error");
      }
    },
    [applyApiResponse, requestAion]
  );

  const requestQuestion = useCallback(
    (question: string, signal: AbortSignal) => requestAion(question, "auto", signal),
    [requestAion]
  );
  const question = useGenUiLabQuestion({ request: requestQuestion, onResponse: applyApiResponse });

  const sendMessage = useCallback<CoreInputProps["sendMessage"]>(
    async (message) => {
      const text =
        typeof message === "object" && message != null && "text" in message
          ? String(message.text ?? "")
          : "";

      const trimmed = text.trim();

      if (!trimmed) return;

      await question.sendQuestion(trimmed);
    },
    [question.sendQuestion]
  );

  const handleSelectType = useCallback(
    (blockType: GenUIBlockType) => {
      setSelectedType(blockType);

      if (stateView != null) {
        // The gallery scroller is unmounted while a state shows, so focus the archetype instead.
        setStateView(null);
        setViewMode("focus");
      } else if (viewMode === "gallery") {
        scrollToType(blockType);
      } else {
        setViewMode("focus");
      }
    },
    [scrollToType, stateView, viewMode]
  );

  const handleResetFixtures = useCallback(() => {
    setBlocks(buildDefaultBlockMap());
    setAionMessage("Reset to fixture data.");
    setError(null);
    setStatus("ready");
  }, []);

  const handleGenerateSelected = useCallback(async () => {
    const label = GEN_UI_REGISTRY[selectedType].label;

    await runAion(
      `Generate fresh, realistic ${label.toLowerCase()} content for the ${selectedType} archetype.`,
      "generate"
    );
  }, [runAion, selectedType]);

  const isProcessing = status === "submitted" || status === "streaming";

  return (
    <div className="@container relative flex h-full min-h-0 min-w-0 flex-col overflow-y-auto">
      {/* Rows are bounded (`minmax(0,1fr)`), not `auto`: a tall block scrolls inside its panel instead of growing the row past the viewport. */}
      <div className="grid min-h-[30rem] min-w-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(16rem,1fr)] gap-4 @min-[56rem]:grid-cols-[240px_minmax(0,1fr)] @min-[56rem]:grid-rows-[minmax(0,1fr)] @min-[56rem]:gap-6">
        <aside className="flex min-h-0 min-w-0 flex-col gap-2 *:shrink-0 @min-[56rem]:gap-4 @min-[56rem]:overflow-y-auto">
          <PageNavBack className="mb-0" href="/sandbox/prototypes">
            ← Prototypes
          </PageNavBack>

          <header className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Gen UI Lab</h1>
            <p className="hidden text-sm text-muted-foreground @min-[56rem]:block">
              Snap-scroll the gallery, focus one archetype, or ask Aion to generate content.
            </p>
          </header>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:bg-foreground focus-visible:text-background focus-visible:outline-none",
                galleryActive
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:text-foreground"
              )}
              onClick={() => {
                setStateView(null);
                setViewMode("gallery");
              }}
            >
              Gallery
            </button>
            <button
              type="button"
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:bg-foreground focus-visible:text-background focus-visible:outline-none",
                viewMode === "focus" && stateView == null
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:text-foreground"
              )}
              onClick={() => {
                setStateView(null);
                setViewMode("focus");
              }}
            >
              Focus
            </button>
          </div>

          <div className="flex min-w-0 items-center gap-inline-md text-xs text-muted-foreground @min-[56rem]:hidden">
            <span>Preview</span>
            <Select
              value={stateView ?? selectedType}
              onValueChange={(value) => {
                const renderingState = GEN_UI_LAB_STATES.find((state) => state.id === value);

                if (renderingState) setStateView(renderingState.id);
                else handleSelectType(value as GenUIBlockType);
              }}
            >
              <SelectTrigger aria-label="Preview component" className="min-h-11 min-w-0 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Archetypes</SelectLabel>
                  {archetypeList.map(({ type, label }) => (
                    <SelectItem key={type} value={type}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Rendering states</SelectLabel>
                  {GEN_UI_LAB_STATES.map(({ id, label }) => (
                    <SelectItem key={id} value={id}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <nav
            aria-label="Gen UI archetypes"
            className="hidden shrink-0 space-y-1 @min-[56rem]:block"
          >
            {archetypeList.map(({ type, label }) => {
              const active = selectedType === type && stateView == null;

              return (
                <button
                  key={type}
                  type="button"
                  className={cn(
                    "flex w-full flex-col items-start gap-0.5 rounded-xl px-3 py-2 text-left text-sm transition-colors focus-visible:bg-foreground focus-visible:text-background focus-visible:outline-none",
                    active
                      ? "bg-primary/10 text-foreground"
                      : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  )}
                  onClick={() => handleSelectType(type)}
                >
                  <span>{label}</span>
                  <span className="text-2xs uppercase tracking-wide opacity-70">
                    {type.replace("-", " ")}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="hidden space-y-1 @min-[56rem]:block">
            <p className="px-3 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              Rendering states
            </p>
            {GEN_UI_LAB_STATES.map(({ id, label, hint }) => (
              <button
                key={id}
                type="button"
                title={hint}
                className={cn(
                  "flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition-colors focus-visible:bg-foreground focus-visible:text-background focus-visible:outline-none",
                  stateView === id
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                )}
                onClick={() => setStateView(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 @min-[56rem]:flex-col">
            <button
              type="button"
              className={cn(
                glass(),
                "inline-flex items-center justify-center gap-2 rounded-xl border border-border/70 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/40 disabled:opacity-60 focus-visible:bg-foreground focus-visible:text-background focus-visible:outline-none"
              )}
              disabled={isProcessing}
              onClick={() => void handleGenerateSelected()}
            >
              {isProcessing ? <Loader2 className="size-4 animate-spin" /> : null}
              Generate with AI
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:bg-foreground focus-visible:text-background focus-visible:outline-none"
              disabled={isProcessing}
              onClick={handleResetFixtures}
            >
              <RotateCcw className="size-3.5" />
              Reset fixtures
            </button>
            <button
              type="button"
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:bg-foreground focus-visible:text-background focus-visible:outline-none"
              aria-expanded={question.isOpen}
              onClick={question.open}
            >
              <span className="font-mono text-xs">/btw</span>
              Ask a question
            </button>
          </div>
          {aionMessage && !question.isOpen ? (
            <p aria-live="polite" className="px-3 text-xs text-muted-foreground">
              {aionMessage}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="px-3 text-xs text-destructive">
              {error.message}
            </p>
          ) : null}
        </aside>

        <section className="relative flex min-h-0 min-w-0 flex-col overflow-hidden">
          {decisionSelected ? <GenUiDecisionDemoToolbar demo={decisionDemo} /> : null}
          {galleryActive ? (
            <GenUiGalleryNav
              activeIndex={selectedIndex}
              count={archetypeList.length}
              labels={archetypeList.map((e) => e.label)}
              onSelectIndex={scrollToIndex}
            />
          ) : null}

          <div
            ref={galleryActive ? scrollRef : undefined}
            className={cn(
              "min-h-0 flex-1",
              galleryActive
                ? "gen-ui-gallery-scroll overflow-y-auto overflow-x-hidden"
                : "overflow-y-auto px-2 py-4"
            )}
          >
            {galleryActive ? (
              archetypeList.map(({ type }) => (
                <GenUiGallerySection
                  key={type}
                  active={selectedType === type}
                  archetype={type}
                  registerRef={registerSection(type)}
                >
                  {type === "decision-matrix" ? (
                    <GenUiDecisionDemo
                      block={blocks[type] as DecisionMatrixBlock}
                      demo={decisionDemo}
                    />
                  ) : (
                    <GenUIRenderer data={{ block: blocks[type] }} messageId={`lab-${type}`} />
                  )}
                </GenUiGallerySection>
              ))
            ) : stateView ? (
              <article className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center">
                <GenUiLabStatePanel state={stateView} />
              </article>
            ) : (
              <article className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center">
                {selectedType === "decision-matrix" ? (
                  <GenUiDecisionDemo
                    block={blocks[selectedType] as DecisionMatrixBlock}
                    demo={decisionDemo}
                  />
                ) : (
                  <GenUIRenderer
                    data={{ block: blocks[selectedType] }}
                    messageId={`lab-focus-${selectedType}`}
                  />
                )}
              </article>
            )}
          </div>
        </section>
      </div>

      {question.isOpen ? (
        <div className="fixed inset-x-4 bottom-4 z-40 mx-auto w-auto max-w-[8.5in]">
          <BtwPanel
            className="absolute inset-x-0 bottom-full mb-2"
            contextDescription="Side question · Gen UI Lab · not saved"
            emptyMessage="Ask about the preview or request a change. Close this to discard the exchange."
            error={question.error}
            messages={question.messages}
            status={question.status}
            onClose={question.close}
          />
          <CoreInput
            clearError={question.clearError}
            defaultMemories={false}
            defaultWebSearch={false}
            error={question.error}
            hideWebMemorySpeechToggles
            featureHints={false}
            modelRef={modelRef}
            sendMessage={sendMessage}
            sentMessageShimmer
            sideThreadKey={question.sessionId}
            snapshotScope={question.scope}
            placeholder="Ask a side question…"
            status={question.status}
            stop={question.stop}
            useMemoriesRef={useMemoriesRef}
            useWebSearchRef={useWebSearchRef}
            variant="compact"
          />
        </div>
      ) : null}
    </div>
  );
}
