"use client";

import type { ProfileBlockProps } from "./profile-block-types";

const PLACEHOLDER_BIO =
  "Your about me will appear here. Generate a summary below or add your own later.";

export function ProfileBlockBio({ summary }: ProfileBlockProps) {
  const hasContent = Boolean(summary?.bio?.trim());
  const text = hasContent ? summary!.bio : PLACEHOLDER_BIO;

  return (
    <section
      aria-labelledby="about-heading"
      className={
        hasContent
          ? "rounded-xl border border-border bg-card/50 px-5 py-5 backdrop-blur-sm md:px-6 md:py-6"
          : "rounded-xl border border-dashed border-border bg-muted/30 px-5 py-5 md:px-6 md:py-6"
      }
    >
      <h2
        className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        id="about-heading"
      >
        About
      </h2>
      <p
        className={
          hasContent
            ? "max-w-[65ch] text-sm leading-[1.65] text-foreground md:text-[15px]"
            : "max-w-[65ch] text-sm leading-relaxed text-muted-foreground italic"
        }
      >
        {text}
      </p>
    </section>
  );
}
