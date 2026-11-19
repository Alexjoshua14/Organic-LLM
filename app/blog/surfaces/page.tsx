import type { Metadata } from "next";

import blogStyles from "@/components/blog/blog-article.module.css";
import { SurfaceCard } from "@/components/blog/surface-card";
import { PageContentFrame, PageNavBack } from "@/components/layout/page-content-frame";
import {
  CHAT_VARIANT_NOTE,
  chatVariantSurfaces,
  getExperienceSurfaceBySlug,
  standaloneSurfaces,
} from "@/lib/onboarding/experience-surfaces";
import { blogIndex } from "@/lib/rabbit-holes/designTokens";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Surfaces · Organic LLM",
  description: "What each way of working in Organic LLM is for, and how they differ.",
};

/**
 * Chat leads (the feature); its two experiences sit beside it; the standalone surfaces form the
 * quiet grid below. The same hierarchy as the blog index, so the two galleries read as a family.
 */
export default function SurfacesBlogIndexPage() {
  const chat = getExperienceSurfaceBySlug("chat");
  const variants = chatVariantSurfaces();
  const others = standaloneSurfaces();

  return (
    <>
      <div aria-hidden className={blogStyles.glow} />
      <PageContentFrame className="@container relative z-10" maxWidth="7xl">
        <PageNavBack href="/blog">← Blog</PageNavBack>
        <div className={blogIndex.sectionGap}>
          <header className={blogIndex.headerStack}>
            <p className={blogIndex.kicker}>Surfaces</p>
            <h1 className={blogIndex.title}>Ways to work in Organic LLM</h1>
            <p className={blogIndex.lede}>{CHAT_VARIANT_NOTE}</p>
          </header>

          {chat ? (
            <section aria-label="Chat and its experiences">
              <ul className={blogIndex.bento}>
                <li className={cn("flex min-w-0", blogIndex.bentoFeature)}>
                  <SurfaceCard index={0} surface={chat} variant="feature" />
                </li>
                {variants.map((v, i) => (
                  <li key={v.slug} className={cn("flex min-w-0", blogIndex.bentoSecondary)}>
                    <SurfaceCard index={i + 1} surface={v} variant="secondary" />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {others.length > 0 ? (
            <section aria-label="Research and work">
              <h2 className={blogIndex.sectionLabel}>Research &amp; work</h2>
              <ul className={blogIndex.grid}>
                {others.map((o, i) => (
                  <li key={o.slug} className="flex min-w-0">
                    <SurfaceCard index={i + 3} surface={o} variant="standard" />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </PageContentFrame>
    </>
  );
}
