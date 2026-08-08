"use client";

import type { RestaurantRating } from "@/lib/schemas/gen-ui/restaurant-card";

import { formatRestaurantStoreType, type RestaurantStoreType } from "@/lib/schemas/gen-ui/restaurant-card";
import {
  RESTAURANT_CARD_HERO_VT_CLASS,
  RESTAURANT_CARD_RATING_VT_CLASS,
  RESTAURANT_CARD_TITLE_VT_CLASS,
  type RestaurantCardViewTransitionNames,
} from "@/lib/view-transitions/restaurant-card";
import { viewTransitionStyle } from "@/lib/view-transitions/style";
import { formatReviewCount } from "./restaurant-card-utils";
import { cn } from "@/lib/utils";

function StarRating({ value, className }: { value: number; className?: string }) {
  const full = Math.floor(value);
  const partial = value - full >= 0.25;

  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          className={cn(
            "size-3.5",
            i < full
              ? "fill-amber-400 text-amber-400"
              : i === full && partial
                ? "fill-amber-400/50 text-amber-400/50"
                : "fill-muted/30 text-muted/30"
          )}
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  );
}

type RestaurantCardCondensedProps = {
  name: string;
  storeType: RestaurantStoreType;
  heroUrl: string;
  heroAlt?: string;
  rating?: RestaurantRating;
  viewTransitionNames: RestaurantCardViewTransitionNames;
  onExpand?: () => void;
};

/** Chat product card — gaze flows image → name → rating → meta (counter-clockwise). */
export function RestaurantCardCondensed({
  name,
  storeType,
  heroUrl,
  heroAlt,
  rating,
  viewTransitionNames,
  onExpand,
}: RestaurantCardCondensedProps) {
  return (
    <button
      type="button"
      className="group flex w-full gap-3 rounded-xl text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      onClick={onExpand}
    >
      <div
        className="relative size-[4.5rem] shrink-0 overflow-hidden rounded-lg bg-muted/40 sm:size-20"
        style={viewTransitionStyle(viewTransitionNames.hero, {
          viewTransitionClass: RESTAURANT_CARD_HERO_VT_CLASS,
        })}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={heroAlt ?? `${name} exterior`}
          className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          src={heroUrl}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-0.5">
        <p
          className="truncate text-sm font-semibold leading-snug text-foreground"
          style={viewTransitionStyle(viewTransitionNames.title, {
            viewTransitionClass: RESTAURANT_CARD_TITLE_VT_CLASS,
          })}
        >
          {name}
        </p>

        {rating ? (
          <div
            className="flex flex-wrap items-center gap-x-2 gap-y-0.5"
            style={viewTransitionStyle(viewTransitionNames.rating, {
              viewTransitionClass: RESTAURANT_CARD_RATING_VT_CLASS,
            })}
          >
            <StarRating value={rating.average} />
            <span className="text-xs font-medium tabular-nums text-foreground/90">
              {rating.average.toFixed(1)}
            </span>
          </div>
        ) : null}

        <p className="text-[11px] text-muted-foreground">
          {rating ? `${formatReviewCount(rating.reviewCount)} reviews` : "Reviews unavailable"}
          <span aria-hidden className="mx-1.5 text-border">
            ·
          </span>
          {formatRestaurantStoreType(storeType)}
        </p>
      </div>
    </button>
  );
}

export { StarRating };
