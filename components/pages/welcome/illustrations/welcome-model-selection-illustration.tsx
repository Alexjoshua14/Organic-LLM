"use client";

import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion } from "framer-motion";

import { usePageVisible } from "@/components/hooks/use-page-visible";
import { useWelcomeInView } from "@/components/pages/welcome/use-welcome-in-view";
import ShinyText from "@/components/ShinyText";
import { ModelZdrIndicator } from "@/components/chat/model-zdr-indicator";
import { glass } from "@/components/design-system/primitives";
import { card, sectionLabel } from "@/lib/rabbit-holes/designTokens";
import {
  AUTO_CHAT_MODEL,
  AUTO_CHAT_MODEL_ID,
  ChatModels,
  type ChatModel,
} from "@/lib/schemas/chat";
import { cn } from "@/lib/utils";

type WelcomeModelSelectionIllustrationProps = {
  className?: string;
};

type HeroPhase = "idle" | "routing" | "resolved";

const ROUTING_MS = 900;
const RESOLVED_HOLD_MS = 2800;
const SCROLL_TO_MODEL_MS = 650;
const MARQUEE_DURATION_S = 48;

const ARIA_LABEL =
  "Model choice per message: Auto chooses from the gateway catalog below; tap Auto to preview a selection. Zero-data-retention indicators mark supported models.";

const gatewayModels = ChatModels.filter((model) => model.id !== AUTO_CHAT_MODEL_ID);

function pickRandomGatewayModel(excludeId?: string): ChatModel {
  const pool =
    excludeId !== undefined
      ? gatewayModels.filter((model) => model.id !== excludeId)
      : gatewayModels;
  const candidates = pool.length > 0 ? pool : gatewayModels;
  const index = Math.floor(Math.random() * candidates.length);

  return candidates[index]!;
}

export function WelcomeModelSelectionIllustration({
  className,
}: WelcomeModelSelectionIllustrationProps) {
  const reduce = useReducedMotion();
  const pageVisible = usePageVisible();
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useWelcomeInView(rootRef);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const segmentRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lastRoutedIdRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);

  const marqueeX = useMotionValue(0);

  const [heroPhase, setHeroPhase] = useState<HeroPhase>("idle");
  const [resolvedModel, setResolvedModel] = useState<ChatModel | null>(null);
  const [marqueePaused, setMarqueePaused] = useState(false);
  const [centeredModelId, setCenteredModelId] = useState<string | null>(null);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
  }, []);

  const stopMarqueeLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const segmentWidth = useCallback(() => {
    return segmentRef.current?.offsetWidth ?? 0;
  }, []);

  const normalizeOffset = useCallback((x: number, width: number) => {
    if (width <= 0) return x;

    let normalized = x % width;
    if (normalized > 0) normalized -= width;

    return normalized;
  }, []);

  const startMarqueeLoop = useCallback(() => {
    stopMarqueeLoop();
    lastFrameRef.current = performance.now();

    const width = segmentWidth();
    if (width > 0) {
      marqueeX.set(normalizeOffset(marqueeX.get(), width));
    }

    const tick = (now: number) => {
      const segment = segmentWidth();
      if (segment <= 0) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const dt = Math.min((now - lastFrameRef.current) / 1000, 0.05);
      lastFrameRef.current = now;

      const velocity = segment / MARQUEE_DURATION_S;
      let x = marqueeX.get() - velocity * dt;

      while (x <= -segment) x += segment;

      marqueeX.set(x);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [marqueeX, normalizeOffset, segmentWidth, stopMarqueeLoop]);

  const scrollMarqueeToModel = useCallback(
    async (modelId: string) => {
      stopMarqueeLoop();

      const viewport = viewportRef.current;
      const index = gatewayModels.findIndex((model) => model.id === modelId);
      const chip = chipRefs.current[index];

      if (!viewport || !chip) return;

      const viewportCenter = viewport.clientWidth / 2;
      const chipCenter = chip.offsetLeft + chip.offsetWidth / 2;
      const targetX = viewportCenter - chipCenter;

      await animate(marqueeX, targetX, {
        duration: SCROLL_TO_MODEL_MS / 1000,
        ease: [0.22, 1, 0.36, 1],
      });
      setCenteredModelId(modelId);
    },
    [marqueeX, stopMarqueeLoop]
  );

  useEffect(() => clearTimers, [clearTimers]);

  useEffect(() => {
    if (reduce || !inView || !pageVisible || marqueePaused || heroPhase !== "idle") {
      stopMarqueeLoop();
      return;
    }

    startMarqueeLoop();

    return stopMarqueeLoop;
  }, [
    heroPhase,
    inView,
    marqueePaused,
    pageVisible,
    reduce,
    startMarqueeLoop,
    stopMarqueeLoop,
  ]);

  useEffect(() => {
    if (!inView || reduce) {
      clearTimers();
      stopMarqueeLoop();
      setHeroPhase("idle");
      setResolvedModel(null);
      setCenteredModelId(null);
      setMarqueePaused(false);
    }
  }, [clearTimers, inView, reduce, stopMarqueeLoop]);

  const handleAutoClick = useCallback(() => {
    if (reduce || heroPhase !== "idle") return;

    clearTimers();
    setHeroPhase("routing");
    setResolvedModel(null);
    setCenteredModelId(null);
    setMarqueePaused(true);
    stopMarqueeLoop();

    schedule(() => {
      const resolved = pickRandomGatewayModel(lastRoutedIdRef.current ?? undefined);
      lastRoutedIdRef.current = resolved.id;
      setResolvedModel(resolved);
      setHeroPhase("resolved");

      void scrollMarqueeToModel(resolved.id).finally(() => {
        schedule(() => {
          setHeroPhase("idle");
          setResolvedModel(null);
          setCenteredModelId(null);
          setMarqueePaused(false);
        }, RESOLVED_HOLD_MS);
      });
    }, ROUTING_MS);
  }, [
    clearTimers,
    heroPhase,
    reduce,
    schedule,
    scrollMarqueeToModel,
    stopMarqueeLoop,
  ]);

  const marqueeCopies = reduce ? 1 : 3;

  return (
    <div
      ref={rootRef}
      aria-label={ARIA_LABEL}
      className={cn(
        "flex h-full min-h-[13rem] flex-col justify-center p-4 sm:min-h-[15rem] sm:p-5",
        className
      )}
      role="img"
    >
      <p className={cn(sectionLabel, "mb-3")}>Model choice</p>

      <div className={cn(card, "relative flex flex-col overflow-hidden px-3 py-6 sm:px-4 sm:py-8")}>
        <div className="flex flex-col items-center gap-2.5 px-2 pt-1 text-center">
          <div className="relative flex min-h-11 w-full max-w-[18rem] items-center justify-center">
            <p
              className={cn(
                "max-w-[15rem] text-xs leading-relaxed text-muted-foreground/75 transition-opacity duration-200",
                heroPhase === "resolved" ? "opacity-0" : "opacity-100"
              )}
            >
              Handles model choice per message, so you don&apos;t have to
            </p>
            {heroPhase === "resolved" && resolvedModel ? (
              <p className="absolute max-w-[18rem] px-2 text-xs text-muted-foreground/80">
                Chose {resolvedModel.name}
              </p>
            ) : null}
          </div>

          <button
            className={cn(
              glass({ opaque: true, border: "all" }),
              "min-w-[5.25rem] rounded-full border border-border/60 px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-shadow",
              "hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
              heroPhase === "resolved" && "ring-1 ring-accent/25"
            )}
            disabled={reduce || heroPhase !== "idle"}
            type="button"
            onClick={handleAutoClick}
          >
            {heroPhase === "routing" ? (
              <ShinyText
                as="span"
                className="text-sm font-medium"
                speed={1.1}
                text="Choosing…"
              />
            ) : (
              AUTO_CHAT_MODEL.name
            )}
          </button>
        </div>

        <div
          className="mt-10 sm:mt-12"
          onMouseEnter={() => {
            if (heroPhase === "idle") {
              setMarqueePaused(true);
              stopMarqueeLoop();
            }
          }}
          onMouseLeave={() => {
            if (heroPhase === "idle") setMarqueePaused(false);
          }}
        >
          <p className="mb-3 text-center text-[10px] font-light uppercase tracking-[0.14em] text-muted-foreground/45">
            Available models
          </p>
          <div
            ref={viewportRef}
            className={cn(
              "overflow-hidden py-2",
              "[mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]"
            )}
          >
            {reduce ? (
              <p className="text-center text-xs leading-relaxed text-muted-foreground/65">
                {gatewayModels.map((model) => model.name).join(" · ")}
              </p>
            ) : (
              <motion.div
                ref={trackRef}
                className="flex w-max will-change-transform"
                style={{ x: marqueeX }}
              >
                {Array.from({ length: marqueeCopies }, (_, copyIndex) => (
                  <div
                    key={`segment-${copyIndex}`}
                    ref={copyIndex === 0 ? segmentRef : undefined}
                    aria-hidden={copyIndex > 0}
                    className="flex shrink-0 items-center gap-x-6 pr-6"
                  >
                    {gatewayModels.map((model, modelIndex) => (
                      <MarqueeModelChip
                        key={`${copyIndex}-${model.id}`}
                        ref={(node) => {
                          if (copyIndex === 0) chipRefs.current[modelIndex] = node;
                        }}
                        highlighted={
                          centeredModelId === model.id && heroPhase === "resolved"
                        }
                        model={model}
                      />
                    ))}
                  </div>
                ))}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const MarqueeModelChip = forwardRef<
  HTMLSpanElement,
  { model: ChatModel; highlighted: boolean }
>(function MarqueeModelChip({ model, highlighted }, ref) {
  return (
    <span
      ref={ref}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 text-xs transition-all duration-300",
        highlighted
          ? "font-medium text-foreground"
          : "font-light text-muted-foreground/55"
      )}
    >
      <span className="max-w-[9rem] truncate sm:max-w-none">{model.name}</span>
      {model.supportsZeroDataRetention ? <ModelZdrIndicator className="opacity-80" /> : null}
    </span>
  );
});

MarqueeModelChip.displayName = "MarqueeModelChip";
