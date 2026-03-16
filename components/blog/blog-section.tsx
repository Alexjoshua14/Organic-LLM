"use client";

import { type ReactNode } from "react";

import { PROSE_CLASS } from "./blog-prose";

import { cn } from "@/lib/utils";

export function BlogSection({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(PROSE_CLASS, className)}>{children}</div>;
}
