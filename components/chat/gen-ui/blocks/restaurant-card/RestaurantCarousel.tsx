"use client";

import type { RestaurantCardBlock } from "@/lib/schemas/gen-ui/restaurant-card";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { RestaurantCard } from "./RestaurantCard";

import { spacing } from "@/lib/design-tokens/spacing";
import { cn } from "@/lib/utils";

/** Hover = muted wash; keyboard focus = inverted fill + underline (no focus rings). */
const navButtonClass =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:bg-foreground focus-visible:text-background focus-visible:underline focus-visible:underline-offset-4";

type RestaurantCarouselProps = {
  blocks: RestaurantCardBlock[];
  className?: string;
  /** Accessible name for the carousel region. */
  label?: string;
};

function nearestSlideIndex(scroller: HTMLElement, slides: HTMLElement[]): number {
  if (slides.length === 0) return 0;
  const left = scroller.scrollLeft;
  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;

  slides.forEach((slide, index) => {
    const dist = Math.abs(slide.offsetLeft - left);

    if (dist < bestDist) {
      bestDist = dist;
      best = index;
    }
  });

  return best;
}

/**
 * Native scroll-snap row of restaurant cards for 2+ adjacent results.
 * Keyboard: Left/Right on the navigation toolbar; prev/next buttons;
 * live region announces “N of M”. Honors prefers-reduced-motion (instant scroll).
 */
export function RestaurantCarousel({
  blocks,
  className,
  label = "Restaurant results",
}: RestaurantCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const labelId = useId();
  const [activeIndex, setActiveIndex] = useState(0);
  const count = blocks.length;

  const syncActive = useCallback(() => {
    const scroller = scrollerRef.current;

    if (!scroller) return;
    const slides = [...scroller.querySelectorAll<HTMLElement>("[data-restaurant-slide]")];

    setActiveIndex(nearestSlideIndex(scroller, slides));
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;

    if (!scroller) return;
    syncActive();
    scroller.addEventListener("scroll", syncActive, { passive: true });

    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => syncActive()) : null;

    ro?.observe(scroller);

    return () => {
      scroller.removeEventListener("scroll", syncActive);
      ro?.disconnect();
    };
  }, [syncActive, count]);

  const scrollToIndex = useCallback(
    (index: number) => {
      const scroller = scrollerRef.current;

      if (!scroller) return;
      const slides = [...scroller.querySelectorAll<HTMLElement>("[data-restaurant-slide]")];
      const target = slides[Math.max(0, Math.min(index, slides.length - 1))];

      if (!target) return;
      scroller.scrollTo({
        left: target.offsetLeft,
        behavior: reducedMotion ? "auto" : "smooth",
      });
    },
    [reducedMotion]
  );

  const goPrev = useCallback(() => {
    scrollToIndex(activeIndex - 1);
  }, [activeIndex, scrollToIndex]);

  const goNext = useCallback(() => {
    scrollToIndex(activeIndex + 1);
  }, [activeIndex, scrollToIndex]);

  const onToolbarKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      }
    },
    [goPrev, goNext]
  );

  if (count < 2) {
    return blocks[0] ? <RestaurantCard block={blocks[0]} /> : null;
  }

  const positionLabel = `${activeIndex + 1} of ${count}`;

  return (
    <div className={cn("not-prose w-full min-w-0", spacing.card.chrome, className)}>
      <div
        ref={scrollerRef}
        aria-labelledby={labelId}
        aria-roledescription="carousel"
        className={cn(
          "flex w-full min-w-0 snap-x snap-mandatory gap-inline-md overflow-x-auto overscroll-x-contain pb-stack-xs",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          !reducedMotion && "scroll-smooth"
        )}
        role="region"
      >
        <span className="sr-only" id={labelId}>
          {label}
        </span>
        {blocks.map((block, index) => (
          <div
            key={`${block.name}-${block.heroImage.url}-${index}`}
            aria-label={`${index + 1} of ${count}: ${block.name}`}
            aria-roledescription="slide"
            className="w-[min(100%,20rem)] shrink-0 snap-start sm:w-[min(100%,22rem)]"
            data-restaurant-slide
            role="group"
          >
            <RestaurantCard block={block} />
          </div>
        ))}
      </div>

      <div
        aria-label="Restaurant carousel navigation"
        className={cn(
          "flex items-center justify-between rounded-lg px-1 py-0.5",
          spacing.gap.sm,
          "focus-visible:outline-none focus-visible:bg-muted/50"
        )}
        role="toolbar"
        tabIndex={0}
        onKeyDown={onToolbarKeyDown}
      >
        <p aria-live="polite" className="text-xs tabular-nums text-muted-foreground">
          {positionLabel}
        </p>
        <div className={cn("flex items-center", spacing.gap.sm)}>
          <button
            type="button"
            aria-label="Previous restaurant"
            className={navButtonClass}
            disabled={activeIndex <= 0}
            onClick={goPrev}
          >
            <ChevronLeft aria-hidden className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next restaurant"
            className={navButtonClass}
            disabled={activeIndex >= count - 1}
            onClick={goNext}
          >
            <ChevronRight aria-hidden className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
