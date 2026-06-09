"use client";

import Image from "next/image";

import { AspectRatio } from "@/components/third-party/ui/aspect-ratio";
import { glass } from "@/components/design-system/primitives";
import {
  welcomeVisualAspect,
  welcomeVisualMaxWidth,
  type WelcomeVisualAspectKey,
  type WelcomeVisualSizeKey,
} from "@/lib/welcome/visual-aspect";
import { cn } from "@/lib/utils";

type WelcomeHighlightVisualProps = {
  id: string;
  imageSrc?: string;
  imageAlt?: string;
  placeholder: { label: string; hint: string };
  /** Aspect ratio tier — matches expected screenshot dimensions. */
  aspect?: WelcomeVisualAspectKey;
  /** Width cap — keeps ratio but prevents full-column sprawl. */
  size?: WelcomeVisualSizeKey;
  className?: string;
};

export function WelcomeHighlightVisual({
  id,
  imageSrc,
  imageAlt,
  placeholder,
  aspect = "highlight",
  size,
  className,
}: WelcomeHighlightVisualProps) {
  const ratio = welcomeVisualAspect[aspect];
  const sizeKey = size ?? aspect;
  const isCompact = sizeKey === "feature";

  const frameClass = cn(
    "relative overflow-hidden rounded-2xl border border-border/50",
    welcomeVisualMaxWidth[sizeKey],
    className
  );

  if (imageSrc) {
    return (
      <AspectRatio className={frameClass} ratio={ratio}>
        <Image
          alt={imageAlt ?? placeholder.hint}
          className="object-cover object-top"
          fill
          sizes={
            isCompact
              ? "(max-width: 768px) 200px, 200px"
              : sizeKey === "mode"
                ? "(max-width: 768px) 100vw, 45vw"
                : "(max-width: 768px) 288px, 320px"
          }
          src={imageSrc}
        />
      </AspectRatio>
    );
  }

  return (
    <AspectRatio className={frameClass} ratio={ratio}>
      <div
        aria-label={placeholder.hint}
        className={cn(
          glass({ opaque: true }),
          "absolute inset-0 flex flex-col items-center justify-center border border-dashed border-border/60 px-3 py-4 text-center",
          isCompact ? "px-2 py-3" : "sm:px-4"
        )}
        data-placeholder-id={id}
        role="img"
      >
        <p
          className={cn(
            "font-medium uppercase tracking-[0.14em] text-muted-foreground",
            isCompact ? "text-[10px]" : "text-xs"
          )}
        >
          {placeholder.label}
        </p>
        <p
          className={cn(
            "mt-1.5 leading-snug text-muted-foreground/80",
            isCompact
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
