"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type GenUiGallerySectionProps = {
  active: boolean;
  archetype: string;
  children: ReactNode;
  className?: string;
  registerRef: (node: HTMLElement | null) => void;
};

/**
 * One full snap page in the gallery — Reforge-inspired inset on inactive neighbors.
 */
export function GenUiGallerySection({
  active,
  archetype,
  children,
  className,
  registerRef,
}: GenUiGallerySectionProps) {
  return (
    <article
      ref={registerRef}
      data-archetype={archetype}
      className={cn(
        "gen-ui-gallery-section min-h-full snap-start snap-always flex w-full items-center justify-center",
        className
      )}
    >
      <div
        className={cn(
          "mx-auto w-full max-w-2xl motion-safe:transition-[transform,padding,opacity] motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.23,1,0.32,1)]",
          active
            ? "scale-100 px-2 py-4 opacity-100"
            : "scale-[0.94] px-6 py-10 opacity-70 sm:px-10"
        )}
      >
        {children}
      </div>
    </article>
  );
}
