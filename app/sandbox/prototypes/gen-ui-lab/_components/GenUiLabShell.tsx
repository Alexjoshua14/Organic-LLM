"use client";

import type { ChatStatus } from "ai";
import type { ComponentProps } from "react";

import { useCallback, useMemo, useRef, useState } from "react";
import { Loader2, RotateCcw, Sparkles } from "lucide-react";

import { GenUIRenderer } from "@/components/chat/gen-ui/GenUIRenderer";
import { GEN_UI_REGISTRY } from "@/components/chat/gen-ui/registry";
import { CoreInput } from "@/components/chat/core-input";
import { PageNavBack } from "@/components/layout/page-content-frame";
import { glass } from "@/components/design-system/primitives";
import { ChatModel, DEFAULT_CHAT_MODEL } from "@/lib/schemas/chat";
import type { GenUIBlock } from "@/lib/schemas/gen-ui";
import { GEN_UI_BLOCK_TYPES, type GenUIBlockType } from "@/lib/schemas/gen-ui/shared";
import {
  buildDefaultBlockMap,
  type GenUiLabApiResponse,
  type GenUiLabViewMode,
} from "@/lib/sandbox/gen-ui-lab";
import { cn } from "@/lib/utils";

import { GenUiGalleryNav } from "./GenUiGalleryNav";
import { GenUiGallerySection } from "./GenUiGallerySection";
import { useGenUiGalleryScroll } from "../_hooks/use-gen-ui-gallery-scroll";

type CoreInputProps = ComponentProps<typeof CoreInput>;

type GenUiLabShellProps = {
  initialBlocks: Record<GenUIBlockType, GenUIBlock>;
};

export function GenUiLabShell({ initialBlocks }: GenUiLabShellProps) {
  const [blocks, setBlocks] = useState(initialBlocks);
  const [selectedType, setSelectedType] = useState<GenUIBlockType>("restaurant-card");
  const [viewMode, setViewMode] = useState<GenUiLabViewMode>("gallery");
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [aionMessage, setAionMessage] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const modelRef = useRef<ChatModel>(DEFAULT_CHAT_MODEL);
  const useWebSearchRef = useRef(false);
  const useMemoriesRef = useRef(false);

  const applyApiResponse = useCallback((response: GenUiLabApiResponse) => {
    setAionMessage(response.message);

    if (response.selection) {
      setSelectedType(response.selection.blockType);
      setViewMode(response.selection.viewMode);
    }

    if (response.generated) {
      setBlocks((prev) => ({
        ...prev,
        [response.generated!.blockType]: response.generated!.block,
      }));
      setSelectedType(response.generated.blockType);
      setViewMode("focus");
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
      enabled: viewMode === "gallery",
      sectionTypes,
      selectedType,
      onSelectType: setSelectedType,
    });

  const runAion = useCallback(
    async (prompt: string, intent: "auto" | "generate" | "select" = "auto") => {
      setStatus("submitted");
      setError(null);

      try {
        const res = await fetch("/api/sandbox/gen-ui-lab", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            selectedBlockType: selectedType,
            viewMode,
            intent,
          }),
        });

        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { error?: string } | null;

          throw new Error(payload?.error ?? `Request failed (${res.status})`);
        }

        const data = (await res.json()) as GenUiLabApiResponse;

        applyApiResponse(data);
        setStatus("ready");
      } catch (err) {
        const nextError = err instanceof Error ? err : new Error(String(err));

        setError(nextError);
        setStatus("error");
      }
    },
    [applyApiResponse, selectedType, viewMode]
  );

  const sendMessage = useCallback<CoreInputProps["sendMessage"]>(
    async (message) => {
      const text =
        typeof message === "object" && message != null && "text" in message
          ? String(message.text ?? "")
          : "";

      const trimmed = text.trim();

      if (!trimmed) return;

      await runAion(trimmed, "auto");
    },
    [runAion]
  );

  const stop = useCallback(async () => {
    setStatus("ready");
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setStatus("ready");
  }, []);

  const handleSelectType = useCallback(
    (blockType: GenUIBlockType) => {
      setSelectedType(blockType);

      if (viewMode === "gallery") {
        scrollToType(blockType);
      } else {
        setViewMode("focus");
      }
    },
    [scrollToType, viewMode]
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
    <div className="relative flex h-full max-h-[calc(100dvh-2rem)] min-h-0 flex-col overflow-hidden">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-6">
        <aside className="flex min-h-0 flex-col gap-4">
          <PageNavBack href="/sandbox/prototypes">← Prototypes</PageNavBack>

          <header className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Gen UI Lab</h1>
            <p className="text-sm text-muted-foreground">
              Snap-scroll the gallery, focus one archetype, or ask Aion to generate content.
            </p>
          </header>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                viewMode === "gallery"
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setViewMode("gallery")}
            >
              Gallery
            </button>
            <button
              type="button"
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                viewMode === "focus"
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setViewMode("focus")}
            >
              Focus
            </button>
          </div>

          <nav aria-label="Gen UI archetypes" className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {archetypeList.map(({ type, label }) => {
              const active = selectedType === type;

              return (
                <button
                  key={type}
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors",
                    active
                      ? "bg-primary/10 text-foreground ring-1 ring-primary/30"
                      : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  )}
                  onClick={() => handleSelectType(type)}
                >
                  <span>{label}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wide opacity-70">
                    {type.replace("-", " ")}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              className={cn(
                glass(),
                "inline-flex items-center justify-center gap-2 rounded-xl border border-border/70 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/40 disabled:opacity-60"
              )}
              disabled={isProcessing}
              onClick={() => void handleGenerateSelected()}
            >
              {isProcessing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Generate with AI
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
              disabled={isProcessing}
              onClick={handleResetFixtures}
            >
              <RotateCcw className="size-3.5" />
              Reset fixtures
            </button>
          </div>
        </aside>

        <section className="relative min-h-0 overflow-hidden rounded-2xl border border-border/70 bg-background/40">
          {viewMode === "gallery" ? (
            <GenUiGalleryNav
              activeIndex={selectedIndex}
              count={archetypeList.length}
              labels={archetypeList.map((e) => e.label)}
              onSelectIndex={scrollToIndex}
            />
          ) : null}

          <div
            ref={viewMode === "gallery" ? scrollRef : undefined}
            className={cn(
              "h-full min-h-0",
              viewMode === "gallery"
                ? "gen-ui-gallery-scroll overflow-y-auto overflow-x-hidden"
                : "overflow-y-auto p-4 sm:p-6"
            )}
          >
            {viewMode === "gallery" ? (
              archetypeList.map(({ type, label }) => (
                <GenUiGallerySection
                  key={type}
                  active={selectedType === type}
                  archetype={type}
                  registerRef={registerSection(type)}
                >
                  <div
                    className={cn(
                      "space-y-4 rounded-2xl border bg-background/60 p-5 shadow-sm backdrop-blur-sm sm:p-6",
                      selectedType === type
                        ? "border-primary/25 ring-1 ring-primary/15"
                        : "border-border/50"
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-3 border-b border-border/40 pb-3">
                      <h2 className="font-commissioner text-lg font-light tracking-tight text-foreground">
                        {label}
                      </h2>
                      <code className="text-[11px] text-muted-foreground">{type}</code>
                    </div>
                    <GenUIRenderer data={{ block: blocks[type] }} messageId={`lab-${type}`} />
                  </div>
                </GenUiGallerySection>
              ))
            ) : (
              <article className="w-full space-y-3">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-sm font-medium text-foreground">
                    {GEN_UI_REGISTRY[selectedType].label}
                  </h2>
                  <code className="text-[11px] text-muted-foreground">{selectedType}</code>
                </div>
                <GenUIRenderer
                  data={{ block: blocks[selectedType] }}
                  messageId={`lab-focus-${selectedType}`}
                />
              </article>
            )}
          </div>
        </section>
      </div>

      <div className="mt-4 space-y-2">
        {aionMessage ? (
          <p aria-live="polite" className="px-1 text-xs text-muted-foreground">
            Aion: {aionMessage}
          </p>
        ) : (
          <p className="px-1 text-xs text-muted-foreground">
            AI runs only when you submit the composer or click Generate with AI.
          </p>
        )}

        <CoreInput
          clearError={clearError}
          defaultMemories={false}
          defaultWebSearch={false}
          error={error}
          hideWebMemorySpeechToggles
          modelRef={modelRef}
          sendMessage={sendMessage}
          sentMessageShimmer
          status={status}
          stop={stop}
          useMemoriesRef={useMemoriesRef}
          useWebSearchRef={useWebSearchRef}
          variant="compact"
        />
      </div>
    </div>
  );
}
