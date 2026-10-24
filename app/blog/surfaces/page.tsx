import Link from "next/link";

import { PageContentFrame, PageNavBack } from "@/components/layout/page-content-frame";
import {
  CHAT_VARIANT_NOTE,
  chatVariantSurfaces,
  EXPERIENCE_SURFACES,
  getExperienceSurfaceBySlug,
  standaloneSurfaces,
  surfaceBlogPath,
} from "@/lib/onboarding/experience-surfaces";

function SurfaceCard({ slug }: { slug: string }) {
  const surface = getExperienceSurfaceBySlug(slug);

  if (!surface) return null;

  return (
    <li>
      <Link
        className="block rounded-lg border border-border bg-secondary p-4 transition-colors hover:bg-secondary/80 text-foreground no-underline"
        href={surfaceBlogPath(surface.slug)}
      >
        <h3 className="font-medium text-foreground">{surface.label}</h3>
        <p className="text-sm text-muted-foreground mt-1">{surface.description}</p>
      </Link>
    </li>
  );
}

export default function SurfacesBlogIndexPage() {
  const chat = getExperienceSurfaceBySlug("chat");
  const variants = chatVariantSurfaces();
  const others = standaloneSurfaces();

  return (
    <PageContentFrame maxWidth="2xl">
      <PageNavBack href="/blog">← Blog</PageNavBack>
      <h1 className="text-2xl font-normal text-foreground mb-2">Surfaces</h1>
      <p className="text-secondary-foreground text-sm mb-2">
        What each workspace mode is for — and how they differ.
      </p>
      <p className="text-xs text-muted-foreground mb-8">{CHAT_VARIANT_NOTE}</p>

      <div className="space-y-10">
        {chat ? (
          <section>
            <h2 className="text-lg font-medium text-foreground mb-4">Chat</h2>
            <ul className="space-y-4">
              <SurfaceCard slug={chat.slug} />
            </ul>
          </section>
        ) : null}

        {variants.length > 0 ? (
          <section>
            <h2 className="text-lg font-medium text-foreground mb-1">Chat experiences</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Subcategories under Chat — same thread spine, tuned for different jobs.
            </p>
            <ul className="space-y-4">
              {variants.map((v) => (
                <SurfaceCard key={v.slug} slug={v.slug} />
              ))}
            </ul>
          </section>
        ) : null}

        {others.length > 0 ? (
          <section>
            <h2 className="text-lg font-medium text-foreground mb-4">Research &amp; work</h2>
            <ul className="space-y-4">
              {others.map((o) => (
                <SurfaceCard key={o.slug} slug={o.slug} />
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <p className="mt-10 text-xs text-muted-foreground">
        {EXPERIENCE_SURFACES.length} surfaces documented · switch anytime from the sidebar rail.
      </p>
    </PageContentFrame>
  );
}
