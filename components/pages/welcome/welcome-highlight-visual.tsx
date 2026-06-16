"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { usePageVisible } from "@/components/hooks/use-page-visible";
import { AspectRatio } from "@/components/third-party/ui/aspect-ratio";
import { welcomeIllustrations } from "@/components/pages/welcome/illustrations";
import { useWelcomeInView } from "@/components/pages/welcome/use-welcome-in-view";
import { glass } from "@/components/design-system/primitives";
import {
  welcomeIllustrationRatio,
  welcomeCompactHighlightIllustrationRatio,
  welcomeModeIllustrationRatio,
  welcomeFeatureIllustrationRatio,
  welcomeVisualAspect,
  welcomeVisualImageSizes,
  welcomeVisualMaxWidth,
  type WelcomeVisualAspectKey,
  type WelcomeVisualSizeKey,
} from "@/lib/welcome/visual-aspect";
import { cn } from "@/lib/utils";

export type WelcomeVisualImageSrc = string | readonly string[];

type WelcomeHighlightVisualProps = {
  id: string;
  imageSrc?: WelcomeVisualImageSrc;
  imageAlt?: string;
  placeholder: { label: string; hint: string };
  /** Aspect ratio tier — matches expected screenshot dimensions. */
  aspect?: WelcomeVisualAspectKey;
  /** Width cap — keeps ratio but prevents full-column sprawl. */
  size?: WelcomeVisualSizeKey;
  className?: string;
  /** Ms between slides when `imageSrc` is an array. */
  cycleIntervalMs?: number;
  /** CSS object-position for screenshots (default keeps app chrome anchored top-left). */
  objectPosition?: string;
  /** When true, only the first image is eagerly loaded; others use lazy loading. */
  lazyImages?: boolean;
};

function normalizeImageSources(imageSrc?: WelcomeVisualImageSrc): string[] {
  if (!imageSrc) return [];

  return typeof imageSrc === "string" ? [imageSrc] : [...imageSrc];
}

export function WelcomeHighlightVisual({
  id,
  imageSrc,
  imageAlt,
  placeholder,
  aspect = "highlight",
  size,
  className,
  cycleIntervalMs = 5000,
  objectPosition = "left top",
  lazyImages = false,
}: WelcomeHighlightVisualProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const Illustration = welcomeIllustrations[id];
  const sizeKey = size ?? aspect;
  const ratio = Illustration
    ? id === "feature-strata"
      ? welcomeFeatureIllustrationRatio
      : id === "streaming"
        ? welcomeCompactHighlightIllustrationRatio
      : sizeKey === "mode"
        ? welcomeModeIllustrationRatio
        : welcomeIllustrationRatio
    : welcomeVisualAspect[aspect];
  const sources = normalizeImageSources(imageSrc);
  const reduce = useReducedMotion();
  const pageVisible = usePageVisible();
  const inView = useWelcomeInView(frameRef);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [sources.join("|")]);

  useEffect(() => {
    if (sources.length <= 1 || reduce || !inView || !pageVisible) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % sources.length);
    }, cycleIntervalMs);

    return () => window.clearInterval(timer);
  }, [cycleIntervalMs, inView, pageVisible, reduce, sources.length]);

  const frameClass = cn(
    "relative rounded-2xl border border-border/50",
    Illustration && id === "gen-ui" ? "overflow-visible" : "overflow-hidden",
    welcomeVisualMaxWidth[sizeKey],
    className
  );

  const imageSizes = welcomeVisualImageSizes[sizeKey];

  if (Illustration) {
    const overflowVisibleIllustration = id === "gen-ui";

    return (
      <AspectRatio ref={frameRef} className={frameClass} ratio={ratio}>
        <motion.div
          aria-label={imageAlt ?? placeholder.hint}
          className={cn(
            "absolute inset-0 rounded-2xl",
            glass({ opaque: true }),
            overflowVisibleIllustration ? "overflow-visible" : "overflow-hidden"
          )}
          data-illustration-id={id}
          initial={reduce ? false : { opacity: 0.85, scale: 0.985 }}
          role="img"
          whileInView={reduce ? undefined : { opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: true, amount: 0.35 }}
        >
          <Illustration className="h-full w-full" />
        </motion.div>
      </AspectRatio>
    );
  }

  if (sources.length > 0) {
    return (
      <AspectRatio ref={frameRef} className={frameClass} ratio={ratio}>
        {sources.map((src, index) => (
          <Image
            key={src}
            alt={imageAlt ?? placeholder.hint}
            aria-hidden={index !== activeIndex}
            className={cn(
              "object-cover transition-opacity duration-700 ease-in-out",
              index === activeIndex ? "opacity-100" : "opacity-0"
            )}
            fill
            loading={lazyImages && index > 0 ? "lazy" : undefined}
            priority={!lazyImages && index === 0}
            quality={90}
            sizes={imageSizes}
            src={src}
            style={{ objectPosition }}
          />
        ))}
      </AspectRatio>
    );
  }

  return (
    <AspectRatio ref={frameRef} className={frameClass} ratio={ratio}>
      <div
        aria-label={placeholder.hint}
        className={cn(
          glass({ opaque: true }),
          "absolute inset-0 flex flex-col items-center justify-center border border-dashed border-border/60 px-3 py-4 text-center",
          sizeKey === "feature" ? "px-2 py-3" : "sm:px-4"
        )}
        data-placeholder-id={id}
        role="img"
      >
        <p
          className={cn(
            "font-medium uppercase tracking-[0.14em] text-muted-foreground",
            sizeKey === "feature" ? "text-[10px]" : "text-xs"
          )}
        >
          {placeholder.label}
        </p>
        <p
          className={cn(
            "mt-1.5 leading-snug text-muted-foreground/80",
            sizeKey === "feature"
              ? "line-clamp-2 text-[10px] sm:text-[11px]"
              : "line-clamp-2 text-xs sm:text-sm"
          )}
        >
          {placeholder.hint}
        </p>
      </div>
    </AspectRatio>
  );
}
