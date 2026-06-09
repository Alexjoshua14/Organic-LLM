"use client";

import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion } from "framer-motion";

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
  "Model choice per message: Auto routes by task through the gateway catalog, with zero-data-retention indicators on supported models.";

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
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lastRoutedIdRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const loopStartRef = useRef(0);
  const loopOffsetRef = useRef(0);

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
    loopOffsetRef.current = marqueeX.get();
  }, [marqueeX]);

  const halfTrackWidth = useCallback(() => {
    const track = trackRef.current;
    if (!track) return 0;

    return track.scrollWidth / 2;
  }, []);

  const startMarqueeLoop = useCallback(() => {
    stopMarqueeLoop();
    loopStartRef.current = performance.now() - (loopOffsetRef.current / halfTrackWidth()) * MARQUEE_DURATION_S * 1000;

    const tick = (now: number) => {
      const width = halfTrackWidth();
      if (width <= 0) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const elapsed = (now - loopStartRef.current) / 1000;
      const progress = (elapsed / MARQUEE_DURATION_S) % 1;
      const x = -progress * width;

      loopOffsetRef.current = x;
      marqueeX.set(x);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [halfTrackWidth, marqueeX, stopMarqueeLoop]);

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

      loopOffsetRef.current = targetX;
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
    if (reduce || marqueePaused || heroPhase !== "idle") {
      stopMarqueeLoop();
      return;
    }

    startMarqueeLoop();

    return stopMarqueeLoop;
  }, [heroPhase, marqueePaused, reduce, startMarqueeLoop, stopMarqueeLoop]);

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

  const marqueeItems = useMemo(
    () => (reduce ? gatewayModels : [...gatewayModels, ...gatewayModels]),
    [reduce]
  );

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

      <div className={cn(card, "relative overflow-hidden px-3 py-8 sm:px-4 sm:py-10")}>
        <div className="pointer-events-none absolute inset-x-0 top-[38%] z-10 flex justify-center">
          <div className="pointer-events-auto flex flex-col items-center gap-2">
            {heroPhase !== "resolved" ? (
              <p className="text-[11px] font-light tracking-wide text-muted-foreground/60">
                Routes by task · pick per message
              </p>
            ) : resolvedModel ? (
              <motion.p
                animate={{ opacity: 1, y: 0 }}
                className="text-[11px] text-muted-foreground/80"
                initial={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.25 }}
              >
                Routed to {resolvedModel.name}
              </motion.p>
            ) : null}

            <button
              className={cn(
                glass({ opaque: true, border: "all" }),
                "rounded-full border border-border/60 px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-shadow",
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
                  text="Routing…"
                />
              ) : (
                AUTO_CHAT_MODEL.name
              )}
            </button>
          </div>
        </div>

        <div
          className="relative mt-14 sm:mt-16"
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
                className="flex w-max items-center gap-x-6 gap-y-2 px-2 will-change-transform"
                style={{ x: marqueeX }}
              >
                {marqueeItems.map((model, index) => {
                  const isFirstCopy = index < gatewayModels.length;
                  const modelIndex = index % gatewayModels.length;
                  const highlighted =
                    centeredModelId === model.id && heroPhase === "resolved";

                  return (
                    <MarqueeModelChip
                      key={`${model.id}-${index}`}
                      ref={(node) => {
                        if (isFirstCopy) chipRefs.current[modelIndex] = node;
                      }}
                      highlighted={highlighted}
                      model={model}
                    />
                  );
                })}
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
          ? "scale-105 font-medium text-foreground"
          : "font-light text-muted-foreground/55"
      )}
    >
      <span className="max-w-[9rem] truncate sm:max-w-none">{model.name}</span>
      {model.supportsZeroDataRetention ? <ModelZdrIndicator className="opacity-80" /> : null}
    </span>
  );
});

MarqueeModelChip.displayName = "MarqueeModelChip";
