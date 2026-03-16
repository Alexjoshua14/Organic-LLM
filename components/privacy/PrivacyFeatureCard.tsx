"use client";

import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PrivacyFeatureCardProps {
  title: ReactNode;
  subtitle: string;
  body: string;
  className?: string;
}

export function PrivacyFeatureCard({ title, subtitle, body, className }: PrivacyFeatureCardProps) {
  return (
    <div
      className={cn(
        "grid h-full grid-rows-[minmax(2.5rem,auto)_minmax(2rem,auto)_1fr] rounded-lg border border-border/60 bg-muted/30 dark:bg-muted/20 px-4 py-3 text-foreground gap-y-1",
        className
      )}
    >
      <h3 className="text-lg font-semibold text-foreground leading-tight">{title}</h3>
      <p className="text-sm font-medium text-muted-foreground leading-tight">{subtitle}</p>
      <p className="min-h-0 overflow-auto text-sm leading-relaxed text-foreground">{body}</p>
    </div>
  );
}
