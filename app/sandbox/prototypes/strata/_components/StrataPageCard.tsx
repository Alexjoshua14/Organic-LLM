import Link from "next/link";

import type { StrataPage } from "@/lib/schemas/strata";
import { formatRecentCalendarDate } from "@/lib/format/stringFormatting";
import ShinyText from "@/components/ShinyText";
import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

type StrataPageCardProps = {
  page: Pick<StrataPage, "id" | "title" | "updated_at">;
};

export function StrataPageCard({ page }: StrataPageCardProps) {
  return (
    <Link
      data-dim-background
      className={cn(
        glass(),
        "group relative flex flex-col gap-6 overflow-hidden rounded-2xl border border-border/70 p-6 backdrop-blur-xl",
        "transition-all duration-300 ease-in-out hover:bg-muted/40 active:scale-[0.995] sm:flex-row sm:items-center sm:justify-between sm:gap-10 sm:p-8"
      )}
      href={`/sandbox/prototypes/strata/${page.id}`}
    >
      <div className="min-w-0 flex-1">
        <h2 className="mb-2 font-commissioner text-lg font-light text-foreground sm:text-xl">
          {page.title}
        </h2>
        <p className="text-xs text-muted-foreground sm:leading-relaxed">
          Updated {formatRecentCalendarDate(page.updated_at)}
        </p>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-4 border-t border-border/50 pt-4 sm:border-t-0 sm:pt-0 sm:justify-end">
        <div className="text-xs text-muted-foreground select-none sm:text-sm">
          <ShinyText
            className="cursor-inherit"
            shimmerOnParentGroupHover
            speed={2.5}
            text="Open"
          />
        </div>
        <svg
          aria-hidden
          className="h-4 w-4 text-muted-foreground opacity-100 transition-all duration-200 group-hover:translate-x-0.5 md:opacity-0 md:group-hover:opacity-100 sm:h-5 sm:w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            d="M17 8l4 4m0 0l-4 4m4-4H3"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
          />
        </svg>
      </div>
    </Link>
  );
}
