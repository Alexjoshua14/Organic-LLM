"use client";

import type { LightBehavior } from "./living-light";
import type { StoredKanbanItem } from "@/lib/kanban/store";
import type { KanbanStatus } from "@/lib/schemas/kanban";

import { motion, useReducedMotion } from "framer-motion";
import { memo, useLayoutEffect, useRef } from "react";

import { PriorityGlyph, StatusGlyph } from "./KanbanGlyphs";
import {
  cssEase,
  LIVING_ACTIVE_BREATH_S,
  LIVING_ATTEND_FADE_S,
  LIVING_ATTEND_SHEEN_S,
  LIVING_BLOOM_S,
  LIVING_CARD_ENTER_S,
  LIVING_CARD_LIFT_S,
  LIVING_CARD_SPRING,
  LIVING_PROGRESS_S,
  LIVING_SETTLE_EASE,
  LIVING_WASH_S,
} from "./living-board-timing";
import { useOneShot } from "./use-one-shot";

import { glass } from "@/components/design-system/primitives";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/third-party/ui/hover-card";
import { KANBAN_STATUS_SHORT_LABELS } from "@/lib/kanban/board-lanes";
import { cn } from "@/lib/utils";

/** Opaque twin of the resting glass card, pitched to the same brightness in dark mode. */
const SOLID_SURFACE = "bg-card dark:bg-[color-mix(in_oklch,var(--card),var(--muted))]";

const WASH_TONE: Record<LightBehavior["wash"], string> = {
  strong: "bg-[rgb(var(--lumen)/0.26)]",
  soft: "bg-[rgb(var(--lumen)/0.16)]",
};

/** Field bloom: the model's warm light, unless the new status carries its own meaning. */
const BLOOM_TONE: Partial<Record<KanbanStatus, string>> = {
  blocked: "rgb(244 63 94 / 0.4)",
  done: "color-mix(in oklch, var(--accent) 55%, transparent)",
};

/** Light rises fast, then settles. */
const LIGHT_KEYFRAMES: Keyframe[] = [
  { opacity: 0, easing: "ease-out" },
  { opacity: 1, offset: 0.1, easing: cssEase(LIVING_SETTLE_EASE) },
  { opacity: 0 },
];

const BLOOM_KEYFRAMES: Keyframe[] = [
  { opacity: 0.9, transform: "scale(0.4)" },
  { opacity: 0, transform: "scale(2.6)" },
];

const SHEEN_KEYFRAMES: Keyframe[] = [
  { transform: "translateX(0)", opacity: 0 },
  { opacity: 1, offset: 0.35 },
  { opacity: 1, offset: 0.65 },
  { transform: "translateX(300%)", opacity: 0 },
];

type QuietCardProps = {
  item: StoredKanbanItem;
  behavior: LightBehavior;
  /** Stamp of the change set that just touched this card. */
  freshStamp?: number;
  /** The model is mid tool call on this card. */
  attended?: boolean;
  /** New to the board: fade in. A card that changed lanes glides instead. */
  entering?: boolean;
  /** Just changed lanes: lift above the other cards for the glide. */
  arriving?: boolean;
  /** Lead the meta line with status, for lists that are not split into status lanes. */
  showStatus?: boolean;
};

/**
 * Title plus one muted meta line; notes wait behind a hover peek. No outlines: state shows as
 * light under or across the card, never as a ring around it.
 */
export const QuietCard = memo(function QuietCard({
  item,
  behavior,
  freshStamp,
  attended = false,
  entering = false,
  arriving = false,
  showStatus = false,
}: QuietCardProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLSpanElement>(null);
  const washRef = useRef<HTMLSpanElement>(null);
  const bloomRef = useRef<HTMLSpanElement>(null);
  const sheenRef = useRef<HTMLSpanElement>(null);
  const arrivingRef = useRef(arriving);
  const isActive = item.status === "active";
  const inProgress = item.progress > 0 && item.progress < 100;
  const tags = item.tags?.slice(0, 2) ?? [];
  // With a presence spark in flight, light waits until the spark lands on the card.
  const lightTiming = { duration: LIVING_WASH_S * 1000, delay: behavior.washDelayS * 1000 };

  useOneShot(washRef, freshStamp, LIGHT_KEYFRAMES, lightTiming);
  useOneShot(
    glowRef,
    behavior.wash === "strong" ? freshStamp : undefined,
    LIGHT_KEYFRAMES,
    lightTiming
  );
  useOneShot(bloomRef, behavior.field ? freshStamp : undefined, BLOOM_KEYFRAMES, {
    duration: LIVING_BLOOM_S * 1000,
    easing: "ease-out",
  });

  useLayoutEffect(() => {
    const sheen = sheenRef.current;

    if (!attended || reduceMotion || typeof sheen?.animate !== "function") return;
    const animation = sheen.animate(SHEEN_KEYFRAMES, {
      duration: LIVING_ATTEND_SHEEN_S * 1000,
      easing: "ease-in-out",
      iterations: Infinity,
    });

    return () => animation.cancel();
  }, [attended, reduceMotion]);

  // A card crossing lanes passes over others; lift it (and the lane it lands in, which may be
  // sliding too) for the length of the glide. Imperative, so the glide never re-renders.
  const lift = () => {
    const card = cardRef.current;

    if (!arrivingRef.current || !card) return;
    card.setAttribute("data-gliding", "");
    card.closest("[data-kanban-lane]")?.setAttribute("data-receiving", "");
  };
  const land = () => {
    const card = cardRef.current;

    arrivingRef.current = false;
    if (!card?.hasAttribute("data-gliding")) return;
    card.removeAttribute("data-gliding");
    const lane = card.closest("[data-kanban-lane]");

    if (lane && !lane.querySelector("[data-gliding]")) lane.removeAttribute("data-receiving");
  };

  const card = (
    <motion.div
      ref={cardRef}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group/card relative isolate rounded-xl outline-none data-[gliding]:z-20",
        item.notes && "focus-visible:ring-2 focus-visible:ring-ring"
      )}
      data-kanban-card={item.id}
      initial={entering ? { opacity: 0, y: 6 } : false}
      layout="position"
      layoutId={item.id}
      tabIndex={item.notes ? 0 : undefined}
      transition={{
        layout: LIVING_CARD_SPRING,
        y: LIVING_CARD_SPRING,
        opacity: { duration: LIVING_CARD_ENTER_S, ease: "easeOut" },
      }}
      onLayoutAnimationComplete={land}
      onLayoutAnimationStart={lift}
    >
      {/* Warm light pooled under the card: gathers while the model works on it, flares on landing. */}
      <span
        ref={glowRef}
        aria-hidden
        className={cn(
          "pointer-events-none absolute -inset-x-1 -bottom-2 top-2 rounded-2xl bg-[rgb(var(--lumen)/0.28)] blur-[12px] transition-opacity",
          attended ? "opacity-100" : "opacity-0"
        )}
        style={{ transitionDuration: `${LIVING_ATTEND_FADE_S}s` }}
      />
      {isActive && behavior.activeRim === "breathing" ? (
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-[3px] rounded-[15px] border-[3px] border-[rgb(var(--lumen)/0.4)] blur-[3px] motion-safe:animate-pulse"
          style={{ animationDuration: `${LIVING_ACTIVE_BREATH_S}s` }}
        />
      ) : null}
      {behavior.field ? (
        <span
          ref={bloomRef}
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 size-24 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0 blur-xl"
          style={{
            background: `radial-gradient(closest-side, ${BLOOM_TONE[item.status] ?? "rgb(var(--lumen) / 0.55)"}, transparent)`,
          }}
        />
      ) : null}
      {/* Translucent at rest; opaque while attended so the glow beneath reads as edge light. */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 rounded-[inherit] transition-[background-color,box-shadow]",
          attended
            ? SOLID_SURFACE
            : behavior.field
              ? "bg-background/55 dark:bg-white/[0.035]"
              : "bg-background/85 dark:bg-white/[0.05]",
          "shadow-[0_0_0_0.5px_rgb(20_21_22/0.07),0_1px_2px_rgb(20_21_22/0.05)] dark:shadow-[0_0_0_0.5px_rgb(255_255_255/0.07)]",
          "group-data-[gliding]/card:bg-card group-data-[gliding]/card:shadow-[0_0_0_0.5px_rgb(20_21_22/0.05),0_14px_30px_-12px_rgb(20_21_22/0.3)]",
          "dark:group-data-[gliding]/card:bg-[color-mix(in_oklch,var(--card),var(--muted))] dark:group-data-[gliding]/card:shadow-[0_14px_30px_-12px_rgb(0_0_0/0.65)]"
        )}
        style={{ transitionDuration: `${LIVING_CARD_LIFT_S}s` }}
      />
      <span
        ref={washRef}
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-[inherit] opacity-0",
          WASH_TONE[behavior.wash]
        )}
      />
      {behavior.presence ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
        >
          <span
            ref={sheenRef}
            className="absolute inset-y-0 -left-1/2 w-1/2 bg-[linear-gradient(100deg,transparent,rgb(var(--lumen)/0.16),transparent)] opacity-0"
          />
        </span>
      ) : null}

      <div className="relative px-3 py-2.5">
        <p
          className={cn(
            "text-[13px] font-medium leading-snug text-foreground",
            item.status === "done" && "text-muted-foreground"
          )}
        >
          {item.title}
        </p>
        <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[11px] leading-none text-muted-foreground">
          {showStatus ? (
            <span className="inline-flex items-center gap-1">
              <StatusGlyph size={12} status={item.status} />
              {KANBAN_STATUS_SHORT_LABELS[item.status]}
              <span aria-hidden className="text-muted-foreground/50">
                ·
              </span>
            </span>
          ) : null}
          <PriorityGlyph priority={item.priority} />
          {item.priority === "urgent" ? (
            <span className="text-rose-500 dark:text-rose-400">Urgent</span>
          ) : null}
          {tags.length > 0 ? <span className="truncate">{tags.join(" · ")}</span> : null}
          {item.notes ? <span className="sr-only">{item.notes}</span> : null}
        </div>
        {inProgress ? (
          <div
            aria-label="Progress"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={item.progress}
            className="mt-2 h-[2px] overflow-hidden rounded-full bg-foreground/[0.07]"
            role="progressbar"
          >
            <div
              className={cn(
                "h-full origin-left rounded-full transition-transform ease-out",
                isActive ? "bg-lumen" : "bg-foreground/35"
              )}
              style={{
                transform: `scaleX(${item.progress / 100})`,
                transitionDuration: `${LIVING_PROGRESS_S}s`,
              }}
            />
          </div>
        ) : null}
      </div>
    </motion.div>
  );

  if (!item.notes) return card;

  return (
    <HoverCard closeDelay={80} openDelay={320}>
      <HoverCardTrigger asChild>{card}</HoverCardTrigger>
      <HoverCardContent
        align="start"
        className={cn(glass({ opaque: true }), "not-prose z-[240] w-56 rounded-lg p-2.5 shadow-sm")}
        side="bottom"
        sideOffset={6}
      >
        <p className="text-[12px] font-medium leading-snug text-foreground">{item.title}</p>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{item.notes}</p>
      </HoverCardContent>
    </HoverCard>
  );
});
