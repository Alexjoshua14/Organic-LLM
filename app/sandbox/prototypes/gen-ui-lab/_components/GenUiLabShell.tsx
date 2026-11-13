"use client";

import type { ChatStatus } from "ai";
import type { ComponentProps } from "react";
import type { DecisionMatrixBlock, GenUIBlock } from "@/lib/schemas/gen-ui";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";

import { useGenUiGalleryScroll } from "../_hooks/use-gen-ui-gallery-scroll";
import { useGenUiLabQuestion } from "../_hooks/use-gen-ui-lab-question";

import { GenUiGalleryNav } from "./GenUiGalleryNav";
import {
  GenUiCodeDemo,
  GenUiCodeDemoToolbar,
  LAB_CODE_LABEL,
  useGenUiCodeDemo,
} from "./GenUiCodeDemo";
import {
  GenUiDecisionDemo,
  GenUiDecisionDemoToolbar,
  useGenUiDecisionDemo,
} from "./GenUiDecisionDemo";
import { GenUiGallerySection } from "./GenUiGallerySection";
import { GEN_UI_LAB_STATES, GenUiLabStatePanel, type GenUiLabStateId } from "./GenUiLabStates";
import {
  GenUiMermaidDiagramDemo,
  GenUiMermaidDiagramDemoToolbar,
  LAB_DIAGRAM_ARCHETYPE,
  LAB_DIAGRAM_LABEL,
  useGenUiMermaidDiagramDemo,
} from "./GenUiMermaidDiagramDemo";

import { GenUIRenderer } from "@/components/chat/gen-ui/GenUIRenderer";
import { GEN_UI_REGISTRY } from "@/components/chat/gen-ui/registry";
import { CoreInput } from "@/components/chat/core-input";
import { BtwPanel } from "@/components/chat/btw/btw-panel";
import { PageNavBack } from "@/components/layout/page-content-frame";
import { glass } from "@/components/design-system/primitives";
import { ChatModel, DEFAULT_CHAT_MODEL } from "@/lib/schemas/chat";
import { GEN_UI_BLOCK_TYPES, type GenUIBlockType } from "@/lib/schemas/gen-ui/shared";
import { buildDefaultBlockMap, type GenUiLabApiResponse } from "@/lib/sandbox/gen-ui-lab";
import { cn } from "@/lib/utils";

type CoreInputProps = ComponentProps<typeof CoreInput>;

/** Keyboard focus is shown by inverting the control (background + text), never a ring. */
const LAB_CONTROL =
  "transition-colors outline-none focus-visible:bg-foreground focus-visible:text-background focus-visible:outline-none";

type GenUiLabShellProps = {
  initialBlocks: Record<GenUIBlockType, GenUIBlock>;
};

/**
 * A gallery page: every Gen UI block type, plus lab-only pages that are not blocks (the Mermaid
 * diagram). Only block types reach the lab API, which knows nothing else.
 */
export type GenUiLabArchetype = GenUIBlockType | typeof LAB_DIAGRAM_ARCHETYPE;

function isBlockType(archetype: GenUiLabArchetype): archetype is GenUIBlockType {
  return archetype !== LAB_DIAGRAM_ARCHETYPE;
}

export function GenUiLabShell({ initialBlocks }: GenUiLabShellProps) {
  const [blocks, setBlocks] = useState(initialBlocks);
  const [selectedType, setSelectedType] = useState<GenUiLabArchetype>("restaurant-card");
  // A rendering state (partial, invalid, streaming) takes the stage from the gallery until an
  // archetype is picked.
  const [stateView, setStateView] = useState<GenUiLabStateId | null>(null);
  // Bumped when a response should bring an archetype into view; `n` makes repeats distinct.
  const [scrollRequest, setScrollRequest] = useState<{
    type: GenUiLabArchetype;
    n: number;
  } | null>(null);
  const galleryActive = stateView == null;
  const decisionSelected = selectedType === "decision-matrix" && galleryActive;
  const decisionDemo = useGenUiDecisionDemo(decisionSelected);
  const diagramDemo = useGenUiMermaidDiagramDemo(
    selectedType === LAB_DIAGRAM_ARCHETYPE && galleryActive
  );
  const codeDemo = useGenUiCodeDemo(selectedType === "code-diff" && galleryActive);
  // Read inside callbacks that must not be recreated on every render.
  const codeDemoRef = useRef(codeDemo);

  codeDemoRef.current = codeDemo;
  const canGenerate = isBlockType(selectedType);
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [aionMessage, setAionMessage] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const modelRef = useRef<ChatModel>(DEFAULT_CHAT_MODEL);
  const useWebSearchRef = useRef(false);
  const useMemoriesRef = useRef(false);

  const applyApiResponse = useCallback((response: GenUiLabApiResponse) => {
    // The server may still send a `viewMode`; the gallery is the only mode, so it is ignored.
    if (response.selection) {
      setSelectedType(response.selection.blockType);
      setStateView(null);
      setScrollRequest((prev) => ({ type: response.selection!.blockType, n: (prev?.n ?? 0) + 1 }));
    }

    if (response.generated) {
      // A generated code diff replaces the fixture, so bring that slide up.
      if (response.generated.blockType === "code-diff") codeDemoRef.current.showFixture();
      setBlocks((prev) => ({
        ...prev,
        [response.generated!.blockType]: response.generated!.block,
      }));
      setSelectedType(response.generated.blockType);
      setStateView(null);
      setScrollRequest((prev) => ({ type: response.generated!.blockType, n: (prev?.n ?? 0) + 1 }));
    }
  }, []);

  const archetypeList = useMemo(() => {
    const entries: Array<{ type: GenUiLabArchetype; label: string }> = GEN_UI_BLOCK_TYPES.map(
      (type) => ({
        type,
        // The code diff page also shows fenced code, so the lab calls it Code.
        label: type === "code-diff" ? LAB_CODE_LABEL : GEN_UI_REGISTRY[type].label,
      })
    );
    // Lab-only, after every block type: it is a chat tool output, not a Gen UI block.
    const diagram = { type: LAB_DIAGRAM_ARCHETYPE, label: LAB_DIAGRAM_LABEL };

    const restaurantIndex = entries.findIndex((e) => e.type === "restaurant-card");

    if (restaurantIndex <= 0) return [...entries, diagram];

    return [
      entries[restaurantIndex]!,
      ...entries.slice(0, restaurantIndex),
      ...entries.slice(restaurantIndex + 1),
      diagram,
    ];
  }, []);

  const sectionTypes = useMemo(() => archetypeList.map((e) => e.type), [archetypeList]);

  const { scrollRef, registerSection, scrollToType, scrollToIndex, selectedIndex } =
    useGenUiGalleryScroll({
      enabled: galleryActive,
      sectionTypes,
      selectedType,
      onSelectType: setSelectedType,
    });

  // Runs after the gallery is (re)mounted, so a response that arrived while a rendering state was
  // showing still lands on its archetype.
  useEffect(() => {
    if (scrollRequest) scrollToType(scrollRequest.type);
  }, [scrollRequest, scrollToType]);

  const requestAion = useCallback(
    async (prompt: string, intent: "auto" | "generate" | "select", signal?: AbortSignal) => {
      const res = await fetch("/api/sandbox/gen-ui-lab", {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json" },
        // The route only knows block types; on a lab-only page it gets no selection at all.
        body: JSON.stringify({
          prompt,
          selectedBlockType: isBlockType(selectedType) ? selectedType : undefined,
          intent,
        }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;

        throw new Error(payload?.error ?? `Request failed (${res.status})`);
      }

      return (await res.json()) as GenUiLabApiResponse;
    },
    [selectedType]
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
    (blockType: GenUiLabArchetype) => {
      setSelectedType(blockType);

      if (stateView != null) {
        // The gallery scroller is unmounted while a state shows. Remounting it scrolls to the
        // selected archetype (see `useGenUiGalleryScroll`).
        setStateView(null);
      } else {
        scrollToType(blockType);
      }
    },
    [scrollToType, stateView]
  );

  const handleResetFixtures = useCallback(() => {
    setBlocks(buildDefaultBlockMap());
    setAionMessage("Reset to fixture data.");
    setError(null);
    setStatus("ready");
  }, []);

  const handleGenerateSelected = useCallback(async () => {
    // Diagrams come from the chat's `make_mermaid_diagram` tool, which the lab API cannot call.
    if (!isBlockType(selectedType)) return;

    const label = GEN_UI_REGISTRY[selectedType].label;

    await runAion(
      `Generate fresh, realistic ${label.toLowerCase()} content for the ${selectedType} archetype.`,
      "generate"
    );
  }, [runAion, selectedType]);

  const isProcessing = status === "submitted" || status === "streaming";

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
    <div
      data-gen-ui-lab-root
      className="@container relative flex h-full min-h-0 min-w-0 flex-col overflow-y-auto"
    >
      {/* Rows are bounded (`minmax(0,1fr)`), not `auto`: a tall block scrolls inside its panel instead of growing the row past the viewport. Narrow (a phone), the lab is the focused component and the dot rail: the control column below only exists from 56rem up. */}
      <div className="grid min-h-[30rem] min-w-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] gap-stack-lg @min-[56rem]:grid-cols-[15rem_minmax(0,1fr)] @min-[56rem]:grid-rows-[minmax(0,1fr)] @min-[56rem]:gap-x-stack-2xl">
        <aside
          className={cn(
            "hidden min-h-0 min-w-0 flex-col gap-stack-md *:shrink-0 @min-[56rem]:flex",
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
                Snap-scroll the gallery, or ask Aion to generate content.
              </p>
            </header>
          </div>

          {/* Wide only: dissolves into the column. */}
          <div className="contents">
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
                // Kept in place (not hidden) so the column does not shift while scrolling past
                // the Diagram page.
                disabled={isProcessing || !canGenerate}
                title={
                  canGenerate
                    ? undefined
                    : "Diagrams come from the chat diagram tool; the lab only generates Gen UI blocks"
                }
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
        <section className="relative flex min-h-0 min-w-0 flex-col pr-8 @min-[56rem]:px-12">
          {/* The decision toolbar lives in its own gallery section (see `header`): mounting it out
              here resized the scroller mid-scroll and broke snapping. */}
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
                  header={
                    type === LAB_DIAGRAM_ARCHETYPE ? (
                      <GenUiMermaidDiagramDemoToolbar demo={diagramDemo} />
                    ) : type === "decision-matrix" ? (
                      <GenUiDecisionDemoToolbar demo={decisionDemo} />
                    ) : type === "code-diff" ? (
                      <GenUiCodeDemoToolbar demo={codeDemo} />
                    ) : undefined
                  }
                  registerRef={registerSection(type)}
                >
                  {type === LAB_DIAGRAM_ARCHETYPE ? (
                    <GenUiMermaidDiagramDemo demo={diagramDemo} />
                  ) : type === "decision-matrix" ? (
                    <GenUiDecisionDemo
                      block={blocks[type] as DecisionMatrixBlock}
                      demo={decisionDemo}
                    />
                  ) : type === "code-diff" ? (
                    <GenUiCodeDemo demo={codeDemo} fixture={blocks[type]} />
                  ) : (
                    <GenUIRenderer data={{ block: blocks[type] }} messageId={`lab-${type}`} />
                  )}
                </GenUiGallerySection>
              ))
            ) : stateView ? (
              <article className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center">
                <GenUiLabStatePanel state={stateView} />
              </article>
            ) : null}
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
