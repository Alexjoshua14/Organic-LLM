import type { ReactNode } from "react";

import Link from "next/link";

import { cn } from "@/lib/utils";
import {
  clusterInsetX,
  pageContentFrameInsets,
  triggerInsetX,
  triggerInsetY,
} from "@/lib/layout/nav-chrome";

const MAX_WIDTH_CLASS = {
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
} as const;

type PageContentFrameMaxWidth = keyof typeof MAX_WIDTH_CLASS;

type PageContentFrameProps = {
  children: ReactNode;
  maxWidth?: PageContentFrameMaxWidth;
  withTopClearance?: boolean;
  className?: string;
};

export function PageContentFrame({
  children,
  maxWidth = "5xl",
  withTopClearance = true,
  className,
}: PageContentFrameProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full",
        MAX_WIDTH_CLASS[maxWidth],
        triggerInsetX,
        clusterInsetX,
        withTopClearance && triggerInsetY,
        "px-6 pb-6",
        className
      )}
    >
      {children}
    </div>
  );
}

type PageNavBackProps = {
  href: string;
  children: ReactNode;
  trailing?: ReactNode;
  className?: string;
};

export function PageNavBack({ href, children, trailing, className }: PageNavBackProps) {
  return (
    <nav className={cn("mb-6 flex flex-wrap items-center justify-between gap-3", className)}>
      <Link
        className="text-sm text-muted-foreground transition-colors hover:text-foreground select-none"
        href={href}
      >
        {children}
      </Link>
      {trailing}
    </nav>
  );
}

export { pageContentFrameInsets, triggerInsetX, clusterInsetX, triggerInsetY };
