"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { type PointerEvent } from "react";

import { BlogArt } from "./blog-art";
import styles from "./blog-card.module.css";

import { glass } from "@/components/design-system/primitives";
import {
  BLOG_CATEGORY_LABELS,
  blogPostHref,
  formatBlogDate,
  type BlogArtId,
  type BlogPost,
} from "@/lib/blog/posts";
import { cn } from "@/lib/utils";

export type BlogCardVariant = "feature" | "secondary" | "standard";

type BlogCardProps = {
  href: string;
  /** The small uppercase label top-left: a category, or "Chat experience". */
  tag: string;
  title: string;
  description: string;
  art: BlogArtId;
  /** The quiet line at the bottom, e.g. "5 min read · Nov 2026". Omit for none. */
  meta?: string;
  variant?: BlogCardVariant;
  /** Position in reading order: staggers the entrance. */
  index?: number;
  className?: string;
};

/**
 * One entry as a glass card. The Lumen spotlight tracks the pointer by writing two CSS variables
 * on the element: no state, no re-render, nothing to do on touch. Keyboard focus uses the shared
 * Lumen focus treatment (`organic-focus`), never a ring.
 */
export function BlogCard({
  href,
  tag,
  title,
  description,
  art,
  meta,
  variant = "standard",
  index = 0,
  className,
}: BlogCardProps) {
  const onPointerMove = (e: PointerEvent<HTMLAnchorElement>) => {
    const box = e.currentTarget.getBoundingClientRect();

    e.currentTarget.style.setProperty("--mx", `${e.clientX - box.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - box.top}px`);
  };

  return (
    <Link
      data-dim-background
      className={cn(
        glass(),
        "border-border/70 backdrop-blur-xl organic-focus",
        styles.card,
        styles.rise,
        styles[variant],
        className
      )}
      href={href}
      style={{ ["--i" as string]: index }}
      onPointerMove={onPointerMove}
    >
      <span className={styles.top}>
        <span className={styles.tag}>{tag}</span>
        <ArrowUpRight aria-hidden className={styles.arrow} />
      </span>
      <BlogArt id={art} />
      <span className={styles.body}>
        <span className={styles.title}>{title}</span>
        <span className={styles.blurb}>{description}</span>
        {meta ? <span className={styles.meta}>{meta}</span> : null}
      </span>
    </Link>
  );
}

/** A registry post as a card. */
export function BlogPostCard({
  post,
  ...rest
}: { post: BlogPost } & Pick<BlogCardProps, "variant" | "index" | "className">) {
  return (
    <BlogCard
      art={post.art}
      description={post.description}
      href={blogPostHref(post.slug)}
      meta={`${post.readMinutes} min read · ${formatBlogDate(post.updated)}`}
      tag={BLOG_CATEGORY_LABELS[post.category]}
      title={post.title}
      {...rest}
    />
  );
}
