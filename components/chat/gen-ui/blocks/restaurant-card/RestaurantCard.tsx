"use client";

import type { RestaurantCardBlock } from "@/lib/schemas/gen-ui/restaurant-card";

import { createPortal } from "react-dom";
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ExternalLink, X } from "lucide-react";

import { formatRestaurantStoreType } from "@/lib/schemas/gen-ui/restaurant-card";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

import { RestaurantCardActions } from "./RestaurantCardActions";
import { RestaurantCardCondensed, StarRating } from "./RestaurantCardCondensed";
import { RestaurantCardHours } from "./RestaurantCardHours";
import { RestaurantCardMenu } from "./RestaurantCardMenu";
import { RestaurantCardPopularTimes } from "./RestaurantCardPopularTimes";
import { formatReviewCount } from "./restaurant-card-utils";

type RestaurantCardExpandedProps = {
  block: RestaurantCardBlock;
  partial?: boolean;
  fullscreen?: boolean;
  onClose?: () => void;
};

function GalleryGrid({ block }: { block: RestaurantCardBlock }) {
  const images = block.gallery ?? [];

  if (images.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
}: {
  block: RestaurantCardBlock;
  partial?: boolean;
  fullscreen?: boolean;
}) {
  return (
    <div className={cn("space-y-5", fullscreen && "pb-8")}>
      <div className="relative overflow-hidden rounded-xl bg-muted/30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={block.heroImage.alt ?? `${block.name} exterior`}
          className="aspect-[16/9] w-full object-cover sm:aspect-[21/9]"
          src={block.heroImage.url}
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-4 pb-4 pt-12">
          <div>
            <p className="text-lg font-semibold text-white sm:text-xl">{block.name}</p>
            {block.rating ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
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

      {block.links?.website ? (
        <a
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          href={block.links.website}
          rel="noopener noreferrer nofollow"
          target="_blank"
        >
          Visit website
          <ExternalLink className="size-4" />
        </a>
      ) : null}

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
        <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
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
          <ExpandedBody block={block} fullscreen partial={partial} />
        </div>
      </div>
    );
  }

  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
    >
      <ExpandedBody block={block} partial={partial} />
    </motion.div>
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
  const morphId = `restaurant-hero-${block.name.replace(/\s+/g, "-").toLowerCase()}`;

  const handleExpand = () => setExpanded(true);
  const handleClose = () => setExpanded(false);

  const showInlineExpanded = expanded && !isMobile;

  return (
    <>
      {!showInlineExpanded ? (
        <RestaurantCardCondensed
          heroAlt={block.heroImage.alt}
          heroUrl={block.heroImage.url}
          layoutId={morphId}
          name={block.name}
          rating={block.rating}
          storeType={block.storeType}
          onExpand={handleExpand}
        />
      ) : (
        <div className="space-y-3">
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={handleClose}
          >
            ← Back to card
          </button>
          <RestaurantCardExpanded block={block} partial={partial} />
        </div>
      )}

      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {expanded && isMobile ? (
                <motion.div
                  key="restaurant-fullscreen"
                  animate={{ opacity: 1 }}
                  className="fixed inset-0 z-[80] bg-background"
                  exit={{ opacity: 0 }}
                  initial={reducedMotion ? false : { opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
                >
                  <motion.div
                    animate={{ y: 0 }}
                    className="h-full"
                    exit={{ y: "8%" }}
                    initial={reducedMotion ? false : { y: "100%" }}
                    transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
                  >
                    <RestaurantCardExpanded
                      block={block}
                      fullscreen
                      partial={partial}
                      onClose={handleClose}
                    />
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body
          )
        : null}

      {partial ? <div className={cn("mt-2 h-3 w-1/2 rounded bg-muted/40 animate-pulse")} /> : null}
    </>
  );
}
