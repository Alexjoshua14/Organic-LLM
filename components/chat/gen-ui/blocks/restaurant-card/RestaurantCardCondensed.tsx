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
import { StarRating } from "./StarRating";

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
