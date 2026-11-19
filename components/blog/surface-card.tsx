import { BlogCard, type BlogCardVariant } from "./blog-card";
import { surfaceArt } from "./surface-art";

import { surfaceBlogPath, type ExperienceSurface } from "@/lib/onboarding/experience-surfaces";

/** The small label on a surface card: where it sits in the family. */
export function surfaceTag(surface: ExperienceSurface): string {
  if (surface.id === "chat") return "Chat";
  if (surface.chatVariant) return "Chat experience";

  return "Research & work";
}

/** A surface as a card. Invited-only surfaces say so on the card, so nobody clicks expecting an app. */
export function SurfaceCard({
  surface,
  variant,
  index,
}: {
  surface: ExperienceSurface;
  variant?: BlogCardVariant;
  index?: number;
}) {
  return (
    <BlogCard
      art={surfaceArt(surface.slug)}
      description={surface.description}
      href={surfaceBlogPath(surface.slug)}
      index={index}
      meta={surface.adminOnly ? "In development · invited accounts" : undefined}
      tag={surfaceTag(surface)}
      title={surface.label}
      variant={variant}
    />
  );
}
