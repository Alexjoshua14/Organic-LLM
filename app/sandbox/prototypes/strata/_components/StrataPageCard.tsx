"use client";

import Link from "next/link";

import { isUntitledStrataTitle, type StrataPage } from "@/lib/schemas/strata";
import { formatRecentCalendarDate } from "@/lib/format/stringFormatting";
import ShinyText from "@/components/ShinyText";
import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

type StrataPageCardProps = {
  page: Pick<StrataPage, "id" | "title" | "updated_at">;
  isGeneratingTitle?: boolean;
  onGenerateTitle?: () => void | Promise<void>;
};

export function StrataPageCard({ page, isGeneratingTitle, onGenerateTitle }: StrataPageCardProps) {
  const showTitleAction = isUntitledStrataTitle(page.title) && onGenerateTitle != null;

  return (
    <div
      className={cn(
        glass(),
        "group relative overflow-hidden rounded-2xl border border-border/70 backdrop-blur-xl"
      )}
    >
      {showTitleAction && (
        <button
          className={cn(
            glass({ opaque: true }),
            "absolute right-4 top-4 z-10 rounded-lg border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          )}
          disabled={isGeneratingTitle}
          type="button"
          onClick={() => void onGenerateTitle()}
        >
          {isGeneratingTitle ? "Generating…" : "Generate title"}
        </button>
      )}
      <Link
        data-dim-background
        className={cn(
          "flex flex-col gap-6 p-6 transition-all duration-300 ease-in-out hover:bg-muted/40 active:scale-[0.995] sm:flex-row sm:items-center sm:justify-between sm:gap-10 sm:p-8",
          showTitleAction && "pr-[7.5rem] sm:pr-[8.5rem]"
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
    </div>
  );
}
