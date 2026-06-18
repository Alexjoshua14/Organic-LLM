"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/third-party/ui/button";
import { cn } from "@/lib/utils";

type IntrospectionNavProps = {
  breadcrumb: string[];
  canGoBack: boolean;
  canGoNext: boolean;
  onBack: () => void;
  onNext: () => void;
  className?: string;
};

export function IntrospectionNav({
  breadcrumb,
  canGoBack,
  canGoNext,
  onBack,
  onNext,
  className,
}: IntrospectionNavProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3 md:px-6",
        className
      )}
    >
      <nav aria-label="Breadcrumb" className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-1 text-sm">
        {breadcrumb.map((crumb, index) => (
          <span key={`${crumb}-${index}`} className="inline-flex items-center gap-1">
            {index > 0 ? <span aria-hidden>/</span> : null}
            <span
              className={cn(
                index === breadcrumb.length - 1 ? "text-foreground font-medium" : undefined
              )}
            >
              {crumb}
            </span>
          </span>
        ))}
      </nav>
      <div className="flex items-center gap-2">
        <Button disabled={!canGoBack} size="sm" type="button" variant="outline" onClick={onBack}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
        <Button disabled={!canGoNext} size="sm" type="button" variant="outline" onClick={onNext}>
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
