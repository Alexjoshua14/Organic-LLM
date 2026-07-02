import Link from "next/link";

import { BlogProse } from "@/components/blog/blog-prose";
import { PageContentFrame, PageNavBack } from "@/components/layout/page-content-frame";
import { Button } from "@/components/third-party/ui/button";
import {
  CHAT_VARIANT_NOTE,
  chatVariantSurfaces,
  getExperienceSurfaceBySlug,
  standaloneSurfaces,
  surfaceBlogPath,
  type ExperienceSurface,
} from "@/lib/onboarding/experience-surfaces";
import { blogArticlePage } from "@/lib/rabbit-holes/designTokens";
import { cn } from "@/lib/utils";

type SurfacePostLayoutProps = {
  surface: ExperienceSurface;
  markdown: string;
};

function RelatedSurfaceLinks({
  title,
  surfaces,
}: {
  title: string;
  surfaces: ExperienceSurface[];
}) {
  if (surfaces.length === 0) return null;

  return (
    <section className="mt-10 border-t border-border pt-6">
      <h2 className="text-sm font-medium text-foreground mb-3">{title}</h2>
      <ul className="space-y-2">
        {surfaces.map((item) => (
          <li key={item.slug}>
            <Link
              className="text-sm text-muted-foreground hover:text-foreground no-underline"
              href={surfaceBlogPath(item.slug)}
            >
              <span className="font-medium text-foreground">{item.label}</span>
              {" — "}
              {item.description}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SurfacePostLayout({ surface, markdown }: SurfacePostLayoutProps) {
  const chatParent = surface.chatVariant ? getExperienceSurfaceBySlug("chat") : undefined;
  const variants = surface.id === "chat" ? chatVariantSurfaces() : [];
  const others = standaloneSurfaces();

  return (
    <PageContentFrame maxWidth="2xl">
      <PageNavBack className={blogArticlePage.navToContent} href="/blog/surfaces">
        ← Surfaces
      </PageNavBack>
      <article className={cn("p-6 sm:p-8 text-foreground", blogArticlePage.blockStack)}>
        {surface.chatVariant && chatParent ? (
          <p className="text-xs text-muted-foreground mb-4">
            Part of{" "}
            <Link className="text-foreground underline-offset-2 hover:underline" href={surfaceBlogPath("chat")}>
              {chatParent.label}
            </Link>
            {" · "}
            {CHAT_VARIANT_NOTE}
          </p>
        ) : null}

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Button asChild size="sm" variant="secondary">
            <Link href={surface.tryHref}>Open {surface.label}</Link>
          </Button>
        </div>

        <BlogProse content={markdown} />

        {surface.id === "chat" ? (
          <RelatedSurfaceLinks surfaces={variants} title="Chat experiences (variants today)" />
        ) : null}

        {surface.id === "chat" ? (
          <RelatedSurfaceLinks surfaces={others} title="Other surfaces" />
        ) : null}

        {surface.chatVariant ? (
          <RelatedSurfaceLinks
            surfaces={[...variants.filter((v) => v.slug !== surface.slug), ...(chatParent ? [chatParent] : [])]}
            title="Related"
          />
        ) : null}

        {!surface.chatVariant && surface.id !== "chat" ? (
          <RelatedSurfaceLinks
            surfaces={[
              getExperienceSurfaceBySlug("chat")!,
              ...others.filter((o) => o.slug !== surface.slug),
            ].filter(Boolean)}
            title="Other surfaces"
          />
        ) : null}
      </article>
    </PageContentFrame>
  );
}
