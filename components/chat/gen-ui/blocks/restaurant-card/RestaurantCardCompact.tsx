"use client";

import type { RestaurantCardBlock } from "@/lib/schemas/gen-ui/restaurant-card";

import { formatReviewCount, resolveTodayHours } from "./restaurant-card-utils";
import { StarRating } from "./StarRating";

import { formatRestaurantStoreType } from "@/lib/schemas/gen-ui/restaurant-card";
import { cn } from "@/lib/utils";

/** Same pill as the expanded card's review-source chips. */
const chipClass =
  "inline-flex max-w-full items-center gap-inline-xs rounded-full bg-muted/50 px-inset-sm py-0.5 text-2xs text-muted-foreground";

/**
 * Static condensed card: photo thumbnail, name, stars, then store-type and today's-hours chips.
 * Unlike `RestaurantCardCondensed` it does not expand, so it can sit in a dense layout.
 */
export function RestaurantCardCompact({ block }: { block: RestaurantCardBlock }) {
  const resolved = block.hours ? resolveTodayHours(block.hours) : null;
  const today =
    resolved && (resolved.isClosed || resolved.label !== "Hours unavailable") ? resolved : null;

  return (
    <article aria-label={block.name} className="flex w-full min-w-0 items-center gap-inline-md">
      <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted/40">
        {/* eslint-disable-next-line @next/next/no-img-element -- Schema-validated remote photo. */}
        <img
          alt={block.heroImage.alt ?? `${block.name} exterior`}
          className="size-full object-cover"
          loading="lazy"
          src={block.heroImage.url}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-inline-xs">
        <h3 className="truncate text-sm font-semibold leading-snug text-foreground">
          {block.name}
        </h3>

        {block.rating ? (
          <p className="flex flex-wrap items-center gap-x-inline-sm gap-y-0.5 text-xs">
            <StarRating value={block.rating.average} />
            <span className="sr-only">Rated {block.rating.average.toFixed(1)} out of 5</span>
            <span aria-hidden className="font-medium tabular-nums text-foreground/90">
              {block.rating.average.toFixed(1)}
            </span>
            <span className="text-muted-foreground">
              {formatReviewCount(block.rating.reviewCount)} reviews
            </span>
          </p>
        ) : null}

        <ul aria-label="Details" className="flex flex-wrap items-center gap-inline-xs">
          <li className={chipClass}>{formatRestaurantStoreType(block.storeType)}</li>
          {today ? (
            <li className={chipClass}>
              <span
                aria-hidden
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  today.isClosed ? "bg-muted-foreground/60" : "bg-accent"
                )}
              />
              <span className="truncate">
                {today.isClosed ? "Closed today" : `Today ${today.label}`}
              </span>
            </li>
          ) : null}
        </ul>
      </div>
    </article>
  );
}
