"use client";

import type { ProfileBlockProps } from "./profile-block-types";

const PLACEHOLDER_TAGS = ["Interests", "skills", "topics"];

export function ProfileBlockTags({ summary }: ProfileBlockProps) {
  const hasContent = Boolean(summary?.tags?.length);
  const tags = hasContent ? summary!.tags : PLACEHOLDER_TAGS;

  return (
    <section
      className={
        hasContent
          ? "rounded-xl border border-border bg-card/50 px-5 py-5 backdrop-blur-sm md:px-6 md:py-6"
          : "rounded-xl border border-dashed border-border bg-muted/30 px-5 py-5 md:px-6 md:py-6"
      }
      aria-labelledby="interests-heading"
    >
      <h2
        id="interests-heading"
        className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
      >
        Interests
      </h2>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, i) => (
          <span
            key={hasContent ? tag : `placeholder-${i}`}
            className={
              hasContent
                ? "rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-foreground"
                : "rounded-full bg-muted/60 px-3 py-1.5 text-xs font-medium text-muted-foreground"
            }
          >
            {tag}
          </span>
        ))}
      </div>
    </section>
  );
}
