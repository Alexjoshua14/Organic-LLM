import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A figure that steps out of the reading column. Wrap tables, diagrams, demos and code in it; the
 * article shell widens anything marked `data-blog-wide` on larger frames and leaves it at column
 * width on phones. Put it directly in the article's flow, not inside a list or another figure:
 * the breakout is centred on the column.
 */
export function BlogFigure({
  children,
  caption,
  className,
}: {
  children: ReactNode;
  caption?: ReactNode;
  className?: string;
}) {
  return (
    <figure data-blog-wide className={cn("not-prose my-stack-2xl min-w-0", className)}>
      {children}
      {caption ? (
        <figcaption className="mt-stack-md text-center text-xs text-muted-foreground">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
