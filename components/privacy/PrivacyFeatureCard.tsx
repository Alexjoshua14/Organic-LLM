"use client";

import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PrivacyFeatureCardProps {
  title: ReactNode;
  subtitle: string;
  body: string;
  className?: string;
}

export function PrivacyFeatureCard({
  title,
  subtitle,
  body,
  className,
}: PrivacyFeatureCardProps) {
  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-lg border border-border/60 bg-muted/30 dark:bg-muted/20 px-4 py-3 text-foreground",
        className,
      )}
    >
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-0.5 text-sm font-medium text-muted-foreground">
        {subtitle}
      </p>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-foreground">
        {body}
      </p>
    </div>
  );
}
