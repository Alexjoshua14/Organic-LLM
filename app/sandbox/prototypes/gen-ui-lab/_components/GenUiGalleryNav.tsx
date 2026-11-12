"use client";

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
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

/** The lab root is a container; the full layout (labelled rail, side column) starts at 56rem. */
const WIDE_ROOT_REM = 56;

/**
 * Whether the lab's own container is wide enough for the full layout, matching the `@min-[56rem]`
 * rules the markup uses. Only the dot's label and slide read this; sizes and positions are CSS, so
 * a first paint is never wrong. With no lab root around (the nav alone) it counts as wide.
 */
function useLabWide(ref: RefObject<HTMLElement | null>) {
  const [wide, setWide] = useState(true);

  useEffect(() => {
    const root = ref.current?.closest<HTMLElement>("[data-gen-ui-lab-root]");

    if (!root) return;

    const measure = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

      setWide(root.getBoundingClientRect().width >= WIDE_ROOT_REM * rem);
    };

    measure();
    const observer = new ResizeObserver(measure);

    observer.observe(root);

    return () => observer.disconnect();
  }, [ref]);

  return wide;
}

type GenUiGalleryNavProps = {
  count: number;
  activeIndex: number;
  labels: string[];
  onSelectIndex: (index: number) => void;
};

type GalleryNavItemProps = {
  active: boolean;
  /** Full layout: the dot slides aside and shows its label. Narrow: a bare dot with a touch target. */
  wide: boolean;
  label: string;
  onSelect: () => void;
  reducedMotion: boolean;
};

/**
 * The whole fixed-width row is the button. The dot rests centred in it; on hover or focus it
 * slides left and the label burns in to its right, all inside the same hit target, so the pointer
 * never has to move to click.
 */
function GalleryNavItem({ active, wide, label, onSelect, reducedMotion }: GalleryNavItemProps) {
  const [open, setOpen] = useState(false);
  const dotLeft = (GALLERY_NAV_ROW_WIDTH_PX - GALLERY_NAV_DOT_SIZE_PX) / 2;

  return (
    <li>
      <button
        type="button"
        aria-current={active ? "true" : undefined}
        aria-label={label}
        // Narrow: a 28px target, dots only (a phone has no hover and no room for labels). Wide:
        // the fixed-width row the label burns into.
        className="relative block size-7 cursor-pointer rounded-full outline-none focus-visible:outline-none @min-[56rem]:h-[var(--row-h)] @min-[56rem]:w-[var(--row-w)]"
        style={
          {
            "--row-w": `${GALLERY_NAV_ROW_WIDTH_PX}px`,
            "--row-h": `${GALLERY_NAV_ROW_HEIGHT_PX}px`,
          } as CSSProperties
        }
        onBlur={() => setOpen(false)}
        onClick={onSelect}
        onFocus={() => setOpen(true)}
        onPointerEnter={() => setOpen(true)}
        onPointerLeave={() => setOpen(false)}
      >
        <motion.span
          animate={{
            x: open && wide ? -GALLERY_NAV_DOT_SHIFT_PX : 0,
            scale: open ? GALLERY_NAV_DOT_HOVER_SCALE : active ? 1 : 0.85,
            opacity: open || active ? 1 : 0.45,
          }}
          className={cn(
            "absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground/30 bg-foreground/20 transition-colors @min-[56rem]:left-[var(--dot-left)] @min-[56rem]:translate-x-0",
            (active || open) && "border-primary/50 bg-primary"
          )}
          initial={false}
          style={
            {
              "--dot-left": `${dotLeft}px`,
              width: GALLERY_NAV_DOT_SIZE_PX,
              height: GALLERY_NAV_DOT_SIZE_PX,
            } as CSSProperties
          }
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
          {open && wide ? (
            <motion.span
              key="label"
              animate={{ opacity: 1 }}
              aria-hidden
              className="absolute top-1/2 -translate-y-1/2 text-xs text-muted-foreground [button:focus-visible_&]:text-foreground"
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
  const navRef = useRef<HTMLElement>(null);
  const wide = useLabWide(navRef);

  return (
    <nav
      ref={navRef}
      aria-label="Gallery sections"
      className="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center @min-[56rem]:-right-3"
    >
      {/* Narrow, the rail is the only chrome: a quiet pill that stays legible over any block. */}
      <ul className="pointer-events-auto flex flex-col gap-0.5 rounded-full bg-background/70 py-1 backdrop-blur-sm @min-[56rem]:gap-1.5 @min-[56rem]:rounded-none @min-[56rem]:bg-transparent @min-[56rem]:py-0 @min-[56rem]:backdrop-blur-none">
        {Array.from({ length: count }).map((_, index) => (
          <GalleryNavItem
            key={index}
            active={index === activeIndex}
            wide={wide}
            label={labels[index] ?? `Section ${index + 1}`}
            reducedMotion={reducedMotion}
            onSelect={() => onSelectIndex(index)}
          />
        ))}
      </ul>
    </nav>
  );
}
