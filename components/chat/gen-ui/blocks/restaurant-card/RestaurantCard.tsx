"use client";

import type { RestaurantCardBlock } from "@/lib/schemas/gen-ui/restaurant-card";

import { createPortal } from "react-dom";
import { useCallback, useMemo, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { X } from "lucide-react";

import { formatRestaurantStoreType } from "@/lib/schemas/gen-ui/restaurant-card";
import { useIsMobile } from "@/hooks/use-mobile";
import { runViewTransition } from "@/lib/view-transitions/run-view-transition";
import {
  type RestaurantCardViewTransitionNames,
  RESTAURANT_CARD_HERO_VT_CLASS,
  RESTAURANT_CARD_RATING_VT_CLASS,
  RESTAURANT_CARD_TITLE_VT_CLASS,
  restaurantCardViewTransitionNames,
} from "@/lib/view-transitions/restaurant-card";
import { viewTransitionStyle } from "@/lib/view-transitions/style";
import { cn } from "@/lib/utils";

import { RestaurantCardActions } from "./RestaurantCardActions";
import { RestaurantCardCondensed, StarRating } from "./RestaurantCardCondensed";
import { RestaurantCardHours } from "./RestaurantCardHours";
import { RestaurantCardMenu } from "./RestaurantCardMenu";
import { RestaurantCardPopularTimes } from "./RestaurantCardPopularTimes";
import { formatReviewCount } from "./restaurant-card-utils";
import { spacing } from "@/lib/design-tokens/spacing";

import "@/lib/view-transitions/view-transitions.css";
import "./RestaurantCard.css";

type RestaurantCardExpandedProps = {
  block: RestaurantCardBlock;
  partial?: boolean;
  fullscreen?: boolean;
  viewTransitionNames: RestaurantCardViewTransitionNames;
  onClose?: () => void;
};

function GalleryGrid({ block }: { block: RestaurantCardBlock }) {
  const images = block.gallery ?? [];

  if (images.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-inline-sm sm:grid-cols-3">
      {images.map((image, index) => (
        <div
          key={`${image.url}-${index}`}
          className={cn(
            "relative overflow-hidden rounded-lg bg-muted/30",
            index === 0
              ? "col-span-2 aspect-[16/10] sm:col-span-1 sm:aspect-square"
              : "aspect-square"
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={image.alt ?? `${block.name} ${image.kind ?? "photo"}`}
            className="size-full object-cover"
            loading="lazy"
            src={image.url}
          />
        </div>
      ))}
    </div>
  );
}

function ExpandedBody({
  block,
  partial,
  fullscreen,
  viewTransitionNames,
}: {
  block: RestaurantCardBlock;
  partial?: boolean;
  fullscreen?: boolean;
  viewTransitionNames: RestaurantCardViewTransitionNames;
}) {
  return (
    <div className={cn(spacing.card.section, fullscreen && "pb-8")}>
      <div className="relative w-full">
        <div
          className="aspect-[16/9] w-full overflow-hidden rounded-xl bg-muted/30 sm:aspect-[21/9]"
          style={viewTransitionStyle(viewTransitionNames.hero, {
            viewTransitionClass: RESTAURANT_CARD_HERO_VT_CLASS,
          })}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={block.heroImage.alt ?? `${block.name} exterior`}
            className="size-full object-cover"
            src={block.heroImage.url}
          />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-xl bg-gradient-to-t from-black/70 via-black/30 to-transparent px-4 pb-4 pt-12">
          <div>
            <p
              className="text-lg font-semibold text-white sm:text-xl"
              style={viewTransitionStyle(viewTransitionNames.title, {
                viewTransitionClass: RESTAURANT_CARD_TITLE_VT_CLASS,
              })}
            >
              {block.name}
            </p>
            {block.rating ? (
              <div
                className={cn("mt-1 flex flex-wrap items-center", spacing.gap.md)}
                style={viewTransitionStyle(viewTransitionNames.rating, {
                  viewTransitionClass: RESTAURANT_CARD_RATING_VT_CLASS,
                })}
              >
                <StarRating
                  className="[&_svg]:fill-white [&_svg]:text-white"
                  value={block.rating.average}
                />
                <span className="text-sm font-medium text-white/95">
                  {block.rating.average.toFixed(1)}
                </span>
                <span className="text-xs text-white/75">
                  {formatReviewCount(block.rating.reviewCount)} reviews ·{" "}
                  {formatRestaurantStoreType(block.storeType)}
                </span>
              </div>
            ) : (
              <p className="text-xs text-white/75">{formatRestaurantStoreType(block.storeType)}</p>
            )}
          </div>
        </div>
      </div>

      {block.summary ? (
        <p className="text-sm leading-relaxed text-muted-foreground">{block.summary}</p>
      ) : null}

      {block.address ? <p className="text-xs text-muted-foreground">{block.address}</p> : null}

      <RestaurantCardActions
        address={block.address}
        links={block.links}
        phone={block.phone}
        size={fullscreen ? "large" : "default"}
      />

      <GalleryGrid block={block} />

      {block.hours ? <RestaurantCardHours hours={block.hours} /> : null}

      {block.popularTimes && block.popularTimes.length > 0 ? (
        <RestaurantCardPopularTimes popularTimes={block.popularTimes} />
      ) : null}

      {block.menu ? <RestaurantCardMenu menu={block.menu} partial={partial} /> : null}

      {block.rating?.sources && block.rating.sources.length > 0 ? (
        <div className={cn("flex flex-wrap text-[11px] text-muted-foreground", spacing.gap.sm)}>
          {block.rating.sources.map((source) => (
            <span key={source.name} className="rounded-full bg-muted/50 px-2 py-0.5 capitalize">
              {source.name}
              {source.rating != null ? ` ${source.rating.toFixed(1)}★` : null}
              {source.reviewCount != null ? ` (${formatReviewCount(source.reviewCount)})` : null}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RestaurantCardExpanded({
  block,
  partial,
  fullscreen = false,
  viewTransitionNames,
  onClose,
}: RestaurantCardExpandedProps) {
  if (fullscreen) {
    return (
      <div className="relative h-full overflow-y-auto overscroll-contain bg-background">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/50 bg-background/95 px-4 py-3 backdrop-blur-md">
          <p className="truncate text-sm font-semibold">{block.name}</p>
          <button
            type="button"
            aria-label="Close restaurant card"
            className="rounded-full p-2 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            onClick={onClose}
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="px-4 pt-4">
          <ExpandedBody
            block={block}
            fullscreen
            partial={partial}
            viewTransitionNames={viewTransitionNames}
          />
        </div>
      </div>
    );
  }

  return (
    <ExpandedBody block={block} partial={partial} viewTransitionNames={viewTransitionNames} />
  );
}

type RestaurantCardProps = {
  block: RestaurantCardBlock;
  partial?: boolean;
};

export function RestaurantCard({ block, partial }: RestaurantCardProps) {
  const isMobile = useIsMobile();
  const reducedMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);

  const viewTransitionNames = useMemo(
    () =>
      restaurantCardViewTransitionNames({
        name: block.name,
        heroUrl: block.heroImage.url,
      }),
    [block.heroImage.url, block.name]
  );

  const handleExpand = useCallback(() => {
    runViewTransition(() => setExpanded(true), { skip: reducedMotion === true });
  }, [reducedMotion]);

  const handleClose = useCallback(() => {
    runViewTransition(() => setExpanded(false), { skip: reducedMotion === true });
  }, [reducedMotion]);

  const showInlineExpanded = expanded && !isMobile;

  return (
    <>
      {!showInlineExpanded ? (
        <RestaurantCardCondensed
          heroAlt={block.heroImage.alt}
          heroUrl={block.heroImage.url}
          name={block.name}
          rating={block.rating}
          storeType={block.storeType}
          viewTransitionNames={viewTransitionNames}
          onExpand={handleExpand}
        />
      ) : (
        <div className={spacing.card.chrome}>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={handleClose}
          >
            ← Back to card
          </button>
          <RestaurantCardExpanded
            block={block}
            partial={partial}
            viewTransitionNames={viewTransitionNames}
          />
        </div>
      )}

      {typeof document !== "undefined"
        ? createPortal(
            expanded && isMobile ? (
              <div className="fixed inset-0 z-[80] bg-background">
                <RestaurantCardExpanded
                  block={block}
                  fullscreen
                  partial={partial}
                  viewTransitionNames={viewTransitionNames}
                  onClose={handleClose}
                />
              </div>
            ) : null,
            document.body
          )
        : null}

      {partial ? <div className={cn("mt-2 h-3 w-1/2 rounded bg-muted/40 animate-pulse")} /> : null}
    </>
  );
}
