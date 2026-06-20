"use client";

import { PageTopBar } from "@/components/layout/page-top-bar";
import { cn } from "@/lib/utils";

type IntrospectionNavProps = {
  breadcrumb: string[];
  title?: string;
  className?: string;
};

function IntrospectionBreadcrumb({ breadcrumb }: { breadcrumb: string[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-1 text-sm"
    >
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
  );
}

export function IntrospectionNav({ breadcrumb, title, className }: IntrospectionNavProps) {
  const displayTitle = title ?? breadcrumb[breadcrumb.length - 1] ?? "Introspection";

  return (
    <PageTopBar
      className={cn("shrink-0", className)}
      eyebrow={<IntrospectionBreadcrumb breadcrumb={breadcrumb} />}
      layout="stacked"
      title={displayTitle}
      withTopClearance
    />
  );
}
