import Link from "next/link";

import { BlogArticleShell } from "./blog-article-shell";
import { BlogProse } from "./blog-prose";
import { SurfaceCard, surfaceTag } from "./surface-card";

import { Button } from "@/components/third-party/ui/button";
import { threadEntryPrefetch } from "@/lib/chat/thread-entry-navigation";
import {
  chatVariantSurfaces,
  getExperienceSurfaceBySlug,
  standaloneSurfaces,
  type ExperienceSurface,
} from "@/lib/onboarding/experience-surfaces";

type SurfacePostLayoutProps = {
  surface: ExperienceSurface;
  markdown: string;
};

/** Two surfaces to suggest after this one: its family first, then the next in the list. */
function relatedSurfaces(surface: ExperienceSurface): ExperienceSurface[] {
  const chat = getExperienceSurfaceBySlug("chat");
  const variants = chatVariantSurfaces();
  const others = standaloneSurfaces();

  if (surface.id === "chat") return variants.slice(0, 2);

  if (surface.chatVariant) {
    return [...variants.filter((v) => v.slug !== surface.slug), ...(chat ? [chat] : [])].slice(
      0,
      2
    );
  }

  const i = others.findIndex((o) => o.slug === surface.slug);
  const next = others[(i + 1) % others.length];

  return [...(chat ? [chat] : []), ...(next && next.slug !== surface.slug ? [next] : [])].slice(
    0,
    2
  );
}

export function SurfacePostLayout({ surface, markdown }: SurfacePostLayoutProps) {
  const related = relatedSurfaces(surface);

  return (
    <BlogArticleShell
      back={{ href: "/blog/surfaces", label: "← Surfaces" }}
      slug={`surface-${surface.slug}`}
      footer={related.map((s, i) => (
        <SurfaceCard key={s.slug} index={i} surface={s} variant="standard" />
      ))}
      meta={
        <div className="mb-stack-lg flex flex-wrap items-center justify-between gap-inline-md">
          <p className="text-2xs font-medium uppercase tracking-widest text-muted-foreground">
            {surfaceTag(surface)}
          </p>
          {surface.adminOnly ? null : (
            <Button asChild size="sm" variant="secondary">
              <Link href={surface.tryHref} prefetch={threadEntryPrefetch(surface.tryHref)}>
                Open {surface.label}
              </Link>
            </Button>
          )}
        </div>
      }
    >
      <BlogProse content={markdown} />
    </BlogArticleShell>
  );
}
