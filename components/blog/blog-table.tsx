import type { ReactNode } from "react";

import { BlogFigure } from "./blog-figure";

/**
 * A small table as a figure: bordered, full width of the figure measure, and scrolling sideways on
 * a phone instead of widening the page. Use it in TSX posts; Markdown tables get the same wrapper
 * from BlogProse. The first column is a row header.
 */
export function BlogTable({
  head,
  rows,
  caption,
}: {
  head: readonly string[];
  rows: ReadonlyArray<readonly ReactNode[]>;
  caption?: string;
}) {
  return (
    <BlogFigure caption={caption}>
      <div className="overflow-x-auto rounded-xl border border-border bg-secondary/40">
        <table className="w-full min-w-max border-collapse text-left text-sm @xl:min-w-0">
          <thead className="bg-secondary/60 text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              {head.map((h) => (
                <th key={h} className="px-inset-lg py-stack-md font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((row, i) => (
              <tr key={i} className="align-top">
                {row.map((cell, j) =>
                  j === 0 ? (
                    <th key={j} className="px-inset-lg py-stack-md font-medium text-foreground">
                      {cell}
                    </th>
                  ) : (
                    <td key={j} className="px-inset-lg py-stack-md text-foreground/90">
                      {cell}
                    </td>
                  )
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BlogFigure>
  );
}
