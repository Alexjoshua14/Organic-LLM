"use client";

import Link from "next/link";

import {
  chatVariantSurfaces,
  getExperienceSurfaceBySlug,
  standaloneSurfaces,
  surfaceBlogPath,
} from "@/lib/onboarding/experience-surfaces";

function SurfaceGuideItem({
  slug,
  indent,
  onDismiss,
}: {
  slug: string;
  indent?: boolean;
  onDismiss?: () => void;
}) {
  const surface = getExperienceSurfaceBySlug(slug);

  if (!surface) return null;

  return (
    <li className={indent ? "pl-3 border-l border-border" : undefined}>
      <Link
        className="text-muted-foreground hover:text-foreground no-underline"
        href={surfaceBlogPath(surface.slug)}
        onClick={() => onDismiss?.()}
      >
        <span className="font-medium text-foreground">{surface.label}</span>
        <span aria-hidden> — </span>
        <span>{surface.description}</span>
      </Link>
    </li>
  );
}

export function ExperienceSurfacesGuide({ onDismiss }: { onDismiss?: () => void }) {
  const variants = chatVariantSurfaces();
  const others = standaloneSurfaces();

  return (
    <div className="mb-3 space-y-3 text-[13px] leading-snug sm:text-sm">
      <div>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
          Chat experiences
        </p>
        <ul className="space-y-2">
          <SurfaceGuideItem onDismiss={onDismiss} slug="chat" />
          {variants.map((v) => (
            <SurfaceGuideItem key={v.slug} indent onDismiss={onDismiss} slug={v.slug} />
          ))}
        </ul>
      </div>

      {others.length > 0 ? (
        <ul className="space-y-2">
          {others.map((o) => (
            <SurfaceGuideItem key={o.slug} onDismiss={onDismiss} slug={o.slug} />
          ))}
        </ul>
      ) : null}

      <p className="text-[11px] text-muted-foreground pt-1">
        <Link className="underline-offset-2 hover:underline" href="/blog/surfaces" onClick={() => onDismiss?.()}>
          Full surface guides →
        </Link>
      </p>
    </div>
  );
}
