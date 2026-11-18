import type { Metadata } from "next";

import { BlogPostCard } from "@/components/blog/blog-card";
import blogStyles from "@/components/blog/blog-article.module.css";
import { PageContentFrame } from "@/components/layout/page-content-frame";
import { BLOG_POSTS } from "@/lib/blog/posts";
import { blogIndex } from "@/lib/rabbit-holes/designTokens";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Blog · Organic LLM",
  description:
    "Short write-ups on how Organic LLM works and why it is built this way: voice, memory, privacy and the interface that ties them together.",
};

/**
 * The blog index, composed to lead the eye. The glow and the title are met first; the feature card
 * is the largest, warmest thing on the page, so the eye lands there next; the two cards beside it
 * are the next step down; the quiet grid below is for browsing. Prominence falls by material
 * (size, light, type) in reading order, left to right and top to bottom, and the entrance
 * stagger follows the same path.
 */
export default function BlogPage() {
  const [feature, ...rest] = BLOG_POSTS;
  const secondary = rest.slice(0, 2);
  const more = rest.slice(2);

  return (
    <>
      <div aria-hidden className={blogStyles.glow} />
      <PageContentFrame className="@container relative z-10" maxWidth="7xl">
        <div className={blogIndex.sectionGap}>
          <header className={blogIndex.headerStack}>
            <p className={blogIndex.kicker}>Coalescence Labs · Notes</p>
            <h1 className={blogIndex.title}>How Organic LLM is built</h1>
            <p className={blogIndex.lede}>
              Short write-ups on how Organic LLM works and why: voice, memory, privacy, and the
              interface that ties them together.
            </p>
          </header>

          <section aria-label="Start here">
            <ul className={blogIndex.bento}>
              <li className={cn("flex min-w-0", blogIndex.bentoFeature)}>
                <BlogPostCard index={0} post={feature} variant="feature" />
              </li>
              {secondary.map((post, i) => (
                <li key={post.slug} className={cn("flex min-w-0", blogIndex.bentoSecondary)}>
                  <BlogPostCard index={i + 1} post={post} variant="secondary" />
                </li>
              ))}
            </ul>
          </section>

          {more.length > 0 ? (
            <section aria-label="More notes">
              <h2 className={blogIndex.sectionLabel}>More notes</h2>
              <ul className={blogIndex.grid}>
                {more.map((post, i) => (
                  <li key={post.slug} className="flex min-w-0">
                    <BlogPostCard index={i + 3} post={post} variant="standard" />
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
