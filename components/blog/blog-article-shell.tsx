import type { ReactNode } from "react";

import { BlogCard } from "./blog-card";
import styles from "./blog-article.module.css";
import { BlogToc } from "./blog-toc";

import { PageContentFrame, PageNavBack } from "@/components/layout/page-content-frame";
import {
  BLOG_CATEGORY_LABELS,
  formatBlogDate,
  getBlogPost,
  relatedBlogPosts,
} from "@/lib/blog/posts";
import { blogArticlePage } from "@/lib/rabbit-holes/designTokens";
import { cn } from "@/lib/utils";

type BlogArticleShellProps = {
  /** The post's registry slug: drives the meta line and the "keep reading" footer. */
  slug: string;
  children: ReactNode;
  /** Back link. Defaults to the blog index; surface posts point at their own index. */
  back?: { href: string; label: string };
  /** Hide the "keep reading" footer (for pages that are not registry posts). */
  hideRelated?: boolean;
};

/**
 * The frame every blog post sits in. It owns the width, the gutters, the page glow, the meta line,
 * the "On this page" rail and the footer, so a post supplies only its words. Tables, diagrams and
 * code step out to a wider measure when they are marked `data-blog-wide` (BlogFigure does it).
 */
export function BlogArticleShell({
  slug,
  children,
  back = { href: "/blog", label: "← Blog" },
  hideRelated,
}: BlogArticleShellProps) {
  const post = getBlogPost(slug);
  const articleId = `blog-article-${slug}`;
  const related = hideRelated ? [] : relatedBlogPosts(slug);

  return (
    <>
      <div aria-hidden className={styles.glow} />
      <PageContentFrame
        className="@container relative z-10"
        maxWidth="8xl"
      >
        <PageNavBack className={blogArticlePage.navToContent} href={back.href}>
          {back.label}
        </PageNavBack>

        <div className={styles.layout}>
          <article className={cn(styles.article, "text-foreground")} id={articleId}>
            {post ? (
              <p className={styles.meta}>
                <span>{BLOG_CATEGORY_LABELS[post.category]}</span>
                <span aria-hidden className={styles.metaDot} />
                <span className={styles.metaItem}>{post.readMinutes} min read</span>
                <span aria-hidden className={styles.metaDot} />
                <span className={styles.metaItem}>Updated {formatBlogDate(post.updated)}</span>
              </p>
            ) : null}
            <div className={blogArticlePage.blockStack}>{children}</div>
          </article>

          <aside className={styles.rail}>
            <BlogToc articleId={articleId} />
          </aside>

          {related.length > 0 ? (
            <section aria-label="Keep reading" className={cn(styles.after, styles.keepReading)}>
              <h2 className={styles.keepReadingLabel}>Keep reading</h2>
              <div className={styles.keepReadingGrid}>
                {related.map((p, i) => (
                  <BlogCard key={p.slug} index={i} post={p} variant="standard" />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </PageContentFrame>
    </>
  );
}
