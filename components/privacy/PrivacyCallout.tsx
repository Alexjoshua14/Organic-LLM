"use client";

import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PrivacyCallout({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border/60 bg-muted/30 dark:bg-muted/20 px-4 py-3 text-sm text-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}
