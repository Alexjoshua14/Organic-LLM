"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import {
  GALLERY_NAV_DOT_HOVER_SCALE,
  GALLERY_NAV_DOT_MOVE_S,
  GALLERY_NAV_DOT_SHIFT_PX,
  GALLERY_NAV_DOT_SIZE_PX,
  GALLERY_NAV_EASE,
  GALLERY_NAV_EXIT_S,
  GALLERY_NAV_LABEL_LEFT_PX,
  GALLERY_NAV_ROW_HEIGHT_PX,
  GALLERY_NAV_ROW_WIDTH_PX,
} from "./gen-ui-gallery-nav-timing";

import { ProcessingTextBurn } from "@/components/chat/processing-text-burn";
import { cn } from "@/lib/utils";

import "./GenUiGalleryNav.css";

type GenUiGalleryNavProps = {
  count: number;
  activeIndex: number;
  labels: string[];
  onSelectIndex: (index: number) => void;
};

type GalleryNavItemProps = {
  active: boolean;
  label: string;
  onSelect: () => void;
  reducedMotion: boolean;
};

/**
 * The whole fixed-width row is the button. The dot rests centred in it; on hover or focus it
 * slides left and the label burns in to its right, all inside the same hit target, so the pointer
 * never has to move to click.
 */
function GalleryNavItem({ active, label, onSelect, reducedMotion }: GalleryNavItemProps) {
  const [open, setOpen] = useState(false);
  const dotLeft = (GALLERY_NAV_ROW_WIDTH_PX - GALLERY_NAV_DOT_SIZE_PX) / 2;

  return (
    <li>
      <button
        type="button"
        aria-current={active ? "true" : undefined}
        aria-label={label}
        className="relative block cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary/50"
        style={{ width: GALLERY_NAV_ROW_WIDTH_PX, height: GALLERY_NAV_ROW_HEIGHT_PX }}
        onBlur={() => setOpen(false)}
        onClick={onSelect}
        onFocus={() => setOpen(true)}
        onPointerEnter={() => setOpen(true)}
        onPointerLeave={() => setOpen(false)}
      >
        <motion.span
          animate={{
            x: open ? -GALLERY_NAV_DOT_SHIFT_PX : 0,
            scale: open ? GALLERY_NAV_DOT_HOVER_SCALE : active ? 1 : 0.85,
            opacity: open || active ? 1 : 0.45,
          }}
          className={cn(
            "absolute top-1/2 block -translate-y-1/2 rounded-full border border-foreground/30 bg-foreground/20 transition-colors",
            (active || open) && "border-primary/50 bg-primary"
          )}
          initial={false}
          style={{
            left: dotLeft,
            width: GALLERY_NAV_DOT_SIZE_PX,
            height: GALLERY_NAV_DOT_SIZE_PX,
          }}
          transition={
            reducedMotion
              ? { duration: 0 }
              : {
                  duration: open ? GALLERY_NAV_DOT_MOVE_S : GALLERY_NAV_EXIT_S,
                  ease: GALLERY_NAV_EASE,
                }
          }
        />
        <AnimatePresence>
          {open ? (
            <motion.span
              key="label"
              animate={{ opacity: 1 }}
              aria-hidden
              className="absolute top-1/2 -translate-y-1/2 text-xs text-muted-foreground"
              exit={{
                opacity: 0,
                transition: { duration: reducedMotion ? 0 : GALLERY_NAV_EXIT_S },
              }}
              initial={{ opacity: 1 }}
              style={{ left: GALLERY_NAV_LABEL_LEFT_PX }}
            >
              <ProcessingTextBurn
                as="span"
                className="gen-ui-gallery-nav__label"
                sustainShimmer={false}
                text={label}
              />
            </motion.span>
          ) : null}
        </AnimatePresence>
      </button>
    </li>
  );
}

export function GenUiGalleryNav({
  count,
  activeIndex,
  labels,
  onSelectIndex,
}: GenUiGalleryNavProps) {
  const reducedMotion = useReducedMotion() === true;

  return (
    <nav
      aria-label="Gallery sections"
      className="pointer-events-none absolute inset-y-0 right-2 z-10 hidden items-center @min-[56rem]:flex"
    >
      <ul className="pointer-events-auto flex flex-col gap-1.5">
        {Array.from({ length: count }).map((_, index) => (
          <GalleryNavItem
            key={index}
            active={index === activeIndex}
            label={labels[index] ?? `Section ${index + 1}`}
            reducedMotion={reducedMotion}
            onSelect={() => onSelectIndex(index)}
          />
        ))}
      </ul>
    </nav>
  );
}
