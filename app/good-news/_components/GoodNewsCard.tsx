import { CheckCircle2 } from "lucide-react";

import { CATEGORY_META, faviconFor, formatDate } from "./category-meta";

import { glass } from "@/components/design-system/primitives";
import { GoodNewsItem } from "@/lib/schemas/good-news";
import { cn } from "@/lib/utils";

type Props = {
  item: GoodNewsItem;
};

export function GoodNewsCard({ item }: Props) {
  const category = CATEGORY_META[item.category] ?? CATEGORY_META.other;
  const publishedLabel = formatDate(item.publishedAt);
  const sourceCount = item.sources.length;

  return (
    <article
      className={cn(
        glass(),
        "rounded-2xl p-5 md:p-6",
        "motion-safe:transition-transform motion-safe:duration-200 hover:motion-safe:-translate-y-0.5"
      )}
    >
      {/* Headline row: title grows left, pills pinned right */}
      <div className="flex items-start gap-3">
        <h2 className="flex-1 line-clamp-2 text-lg font-semibold leading-snug text-foreground md:text-xl">
          {item.headline}
        </h2>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 pt-0.5">
          <span className={cn("rounded-full px-2 py-px text-2xs font-medium", category.badgeClass)}>
            {category.label}
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-px text-2xs font-medium text-emerald-700 dark:text-emerald-300"
            title={item.verification}
          >
            <CheckCircle2 aria-hidden="true" className="h-3 w-3" />
            Verified
            <span aria-hidden="true">·</span>
            <span>
              {sourceCount} source{sourceCount === 1 ? "" : "s"}
            </span>
          </span>
        </div>
      </div>

      {/* Date below headline */}
      {publishedLabel ? (
        <p className="mt-1 text-2xs text-muted-foreground">{publishedLabel}</p>
      ) : null}

      <p className="mt-2 text-sm leading-relaxed text-foreground/90">{item.summary}</p>

      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground/80">Why it matters: </span>
        {item.whyItMatters}
      </p>

      <div className="mt-4 border-t border-border/40 pt-3">
        <h3 className="sr-only">Sources for {item.headline}</h3>
        <ul className="flex flex-wrap gap-2">
          {item.sources.map((source) => (
            <li key={source.url}>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border border-border/50 px-2.5 py-1",
                  "text-xs text-foreground/80 no-underline",
                  "motion-safe:transition-colors hover:border-accent/40 hover:text-foreground",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                )}
                aria-label={`${source.title} on ${source.domain}${source.tier === "high_trust" ? " (high-trust source)" : ""} — opens in a new tab`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={faviconFor(source.domain)}
                  alt=""
                  aria-hidden="true"
                  width={14}
                  height={14}
                  className="h-3.5 w-3.5 rounded-sm"
                  loading="lazy"
                />
                <span className="max-w-[14rem] truncate">{source.domain}</span>
                {source.tier === "high_trust" ? (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                    title="High-trust source"
                    aria-hidden="true"
                  />
                ) : null}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
