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
  type BlogPost,
} from "@/lib/blog/posts";
import { cn } from "@/lib/utils";

export type BlogCardVariant = "feature" | "secondary" | "standard";

type BlogCardProps = {
  post: BlogPost;
  variant?: BlogCardVariant;
  /** Position in reading order: staggers the entrance. */
  index?: number;
  className?: string;
};

/**
 * One post as a glass card. The Lumen spotlight tracks the pointer by writing two CSS variables
 * on the element: no state, no re-render, nothing to do on touch. Keyboard focus uses the shared
 * Lumen focus treatment (`organic-focus`), never a ring.
 */
export function BlogCard({ post, variant = "standard", index = 0, className }: BlogCardProps) {
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
      href={blogPostHref(post.slug)}
      style={{ ["--i" as string]: index }}
      onPointerMove={onPointerMove}
    >
      <span className={styles.top}>
        <span className={styles.tag}>{BLOG_CATEGORY_LABELS[post.category]}</span>
        <ArrowUpRight aria-hidden className={styles.arrow} />
      </span>
      <BlogArt id={post.art} />
      <span className={styles.body}>
        <span className={styles.title}>{post.title}</span>
        <span className={styles.blurb}>{post.description}</span>
        <span className={styles.meta}>
          {post.readMinutes} min read · {formatBlogDate(post.updated)}
        </span>
      </span>
    </Link>
  );
}
