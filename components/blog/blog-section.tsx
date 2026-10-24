"use client";

import { type ReactNode } from "react";

import { BLOG_ARTICLE_BODY_CLASS } from "./blog-prose";

import { cn } from "@/lib/utils";

export function BlogSection({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(BLOG_ARTICLE_BODY_CLASS, className)}>{children}</div>;
}
