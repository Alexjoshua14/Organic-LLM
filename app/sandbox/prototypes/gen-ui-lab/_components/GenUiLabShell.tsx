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

/** Keyboard focus is shown by inverting the control (background + text), never a ring. */
const LAB_CONTROL =
  "transition-colors outline-none focus-visible:bg-foreground focus-visible:text-background focus-visible:outline-none";

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

  const viewToggleButton = (label: string, pressed: boolean, onClick: () => void) => (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        LAB_CONTROL,
        "min-h-8 rounded-full px-inset-md text-xs font-medium",
        pressed ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
      )}
      onClick={onClick}
    >
      {label}
    </button>
  );

  const listButtonClass = (active: boolean) =>
    cn(
      LAB_CONTROL,
      // Text lines up with the header; the hover/active surface bleeds out to the column edge.
      "-mx-inset-md flex min-h-9 w-[calc(100%+var(--spacing-inset-md)*2)] flex-col items-start justify-center gap-0.5 rounded-xl px-inset-md py-1.5 text-left text-sm",
      active
        ? "bg-primary/10 text-foreground"
        : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
    );

  return (
    <div className="@container relative flex h-full min-h-0 min-w-0 flex-col overflow-y-auto">
      {/* Rows are bounded (`minmax(0,1fr)`), not `auto`: a tall block scrolls inside its panel instead of growing the row past the viewport. */}
      <div className="grid min-h-[30rem] min-w-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(16rem,1fr)] gap-stack-lg @min-[56rem]:grid-cols-[15rem_minmax(0,1fr)] @min-[56rem]:grid-rows-[minmax(0,1fr)] @min-[56rem]:gap-x-stack-2xl">
        <aside
          className={cn(
            "flex min-h-0 min-w-0 flex-col gap-stack-md *:shrink-0",
            // Wide: its own scroller. The gutter keeps rows out from under the scrollbar.
            "@min-[56rem]:gap-stack-lg @min-[56rem]:overflow-y-auto @min-[56rem]:px-inset-md @min-[56rem]:[scrollbar-gutter:stable]"
          )}
        >
          <div className="space-y-stack-sm">
            <PageNavBack className="mb-0" href="/sandbox/prototypes">
              ← Prototypes
            </PageNavBack>
            <header className="space-y-stack-xs">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">Gen UI Lab</h1>
              <p className="hidden text-sm text-muted-foreground @min-[56rem]:block">
                Snap-scroll the gallery, focus one archetype, or ask Aion to generate content.
              </p>
            </header>
          </div>

          {/* Narrow: one wrapping row of controls. Wide: dissolves into the column. */}
          <div className="flex min-w-0 flex-wrap items-center gap-inline-sm @min-[56rem]:contents">
            <div
              className="inline-flex w-fit items-center gap-0.5 rounded-full border border-border p-0.5"
              role="group"
              aria-label="Preview mode"
            >
              {viewToggleButton("Gallery", galleryActive, () => {
                setStateView(null);
                setViewMode("gallery");
              })}
              {viewToggleButton("Focus", viewMode === "focus" && stateView == null, () => {
                setStateView(null);
                setViewMode("focus");
              })}
            </div>

            <div className="flex min-w-[12rem] flex-1 items-center gap-inline-sm text-xs text-muted-foreground @min-[56rem]:hidden">
              <span>Preview</span>
              <Select
                value={stateView ?? selectedType}
                onValueChange={(value) => {
                  const renderingState = GEN_UI_LAB_STATES.find((state) => state.id === value);

                  if (renderingState) setStateView(renderingState.id);
                  else handleSelectType(value as GenUIBlockType);
                }}
              >
                <SelectTrigger
                  aria-label="Preview component"
                  className="min-h-11 min-w-0 flex-1 focus-visible:border-transparent focus-visible:bg-foreground focus-visible:text-background focus-visible:ring-0 focus-visible:[&_svg]:text-background"
                >
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
              className="hidden shrink-0 space-y-stack-xs @min-[56rem]:block"
            >
              {archetypeList.map(({ type, label }) => (
                <button
                  key={type}
                  type="button"
                  aria-current={selectedType === type && stateView == null ? "true" : undefined}
                  className={listButtonClass(selectedType === type && stateView == null)}
                  onClick={() => handleSelectType(type)}
                >
                  <span>{label}</span>
                  <span className="text-2xs uppercase tracking-wide opacity-70">
                    {type.replace("-", " ")}
                  </span>
                </button>
              ))}
            </nav>

            <div className="hidden space-y-stack-xs @min-[56rem]:block">
              <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                Rendering states
              </p>
              {GEN_UI_LAB_STATES.map(({ id, label, hint }) => (
                <button
                  key={id}
                  type="button"
                  title={hint}
                  aria-current={stateView === id ? "true" : undefined}
                  className={listButtonClass(stateView === id)}
                  onClick={() => setStateView(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-inline-sm @min-[56rem]:flex-col @min-[56rem]:items-stretch">
              <button
                type="button"
                className={cn(
                  glass(),
                  LAB_CONTROL,
                  "inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-border/70 px-inset-md text-sm font-medium hover:bg-muted/40 disabled:opacity-60"
                )}
                disabled={isProcessing}
                onClick={() => void handleGenerateSelected()}
              >
                {isProcessing ? <Loader2 className="size-4 animate-spin" /> : null}
                Generate with AI
              </button>
              <button
                type="button"
                className={cn(
                  LAB_CONTROL,
                  "inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-border px-inset-md text-xs text-muted-foreground hover:text-foreground disabled:opacity-60"
                )}
                disabled={isProcessing}
                onClick={handleResetFixtures}
              >
                <RotateCcw className="size-3.5" />
                Reset fixtures
              </button>
              <button
                type="button"
                className={cn(
                  LAB_CONTROL,
                  "inline-flex min-h-9 items-center justify-center gap-2 rounded-xl px-inset-md text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                )}
                aria-expanded={question.isOpen}
                onClick={question.open}
              >
                <span className="font-mono text-xs">/btw</span>
                Ask a question
              </button>
            </div>
          </div>

          {aionMessage && !question.isOpen ? (
            <p aria-live="polite" className="text-xs text-muted-foreground">
              {aionMessage}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error.message}
            </p>
          ) : null}
        </aside>

        {/*
          The stage. Wide, it keeps symmetric side room so the content column stays centred in
          it and the gallery dots (overlaid on the right edge) never sit on top of content. The
          side question dock lives in this column, so it centres on the preview, not the page.
        */}
        <section className="relative flex min-h-0 min-w-0 flex-col @min-[56rem]:px-12">
          {decisionSelected ? (
            <div className="mx-auto w-full max-w-2xl shrink-0">
              <GenUiDecisionDemoToolbar demo={decisionDemo} />
            </div>
          ) : null}
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
                : // Symmetric gutter: a visible scrollbar never covers content or off-centres it.
                  "overflow-y-auto overflow-x-hidden py-stack-lg [scrollbar-gutter:stable_both-edges]"
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
            ) : (
              <article className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center">
                {stateView ? (
                  <GenUiLabStatePanel state={stateView} />
                ) : selectedType === "decision-matrix" ? (
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

          {question.isOpen ? (
            <div className="relative z-40 mx-auto w-full max-w-2xl shrink-0 pt-stack-md">
              <BtwPanel
                className="absolute inset-x-0 bottom-full"
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
        </section>
      </div>
    </div>
  );
}
