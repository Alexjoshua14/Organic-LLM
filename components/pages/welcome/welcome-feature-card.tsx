"use client";

import { WelcomeHighlightVisual, type WelcomeVisualImageSrc } from "./welcome-highlight-visual";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

type WelcomeFeatureCardProps = {
  title: string;
  body: string;
  placeholderId: string;
  visualPlaceholder: { label: string; hint: string };
  imageSrc?: WelcomeVisualImageSrc;
  className?: string;
};

export function WelcomeFeatureCard({
  title,
  body,
  placeholderId,
  visualPlaceholder,
  imageSrc,
  className,
}: WelcomeFeatureCardProps) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col rounded-2xl border border-border/50 p-4 sm:p-5",
        glass({ border: "none", opaque: true }),
        className
      )}
    >
      <h3 className="font-commissioner text-base font-light tracking-tight text-foreground sm:text-lg">
        {title}
      </h3>
      <p className="mt-1.5 line-clamp-3 flex-1 text-sm leading-snug text-muted-foreground">
        {body}
      </p>
      <div className="mt-3 w-full shrink-0">
        <WelcomeHighlightVisual
          aspect="feature"
          id={placeholderId}
          imageAlt={visualPlaceholder.hint}
          imageSrc={imageSrc}
          lazyImages
          placeholder={visualPlaceholder}
          size="mode"
        />
      </div>
    </div>
  );
}
