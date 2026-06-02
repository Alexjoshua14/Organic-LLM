"use client";

import Link from "next/link";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

const links = [
  { href: "/chat", label: "Chat" },
  { href: "/sandbox/arcadia", label: "Arcadia" },
  { href: "/sandbox/prototypes/strata", label: "Strata" },
  { href: "/rabbitholes/browse", label: "Rabbit holes" },
  { href: "/showcase", label: "Showcase" },
] as const;

const stack = [
  "Next.js",
  "React",
  "AI SDK",
  "Clerk",
  "Supabase",
  "Mem0",
  "TailwindCSS",
  "Qdrant",
  "ElevenLabs",
  "Redis",
];

type ShowcaseOverviewProps = {
  className?: string;
  /** Top intro strip (e.g. anatomy page) vs bottom `<footer>` layout. */
  placement?: "intro" | "footer";
};

export function ShowcaseOverview({ className, placement = "footer" }: ShowcaseOverviewProps) {
  const intro = placement === "intro";
  const Tag = intro ? "div" : "footer";

  const body = (
    <>
      <p className="mx-auto mb-6 max-w-2xl leading-relaxed sm:mx-0">
        <strong className="font-medium text-foreground">Organic LLM</strong> is a UI lab and
        cognition lab for chat: memory, grounded tools, and streaming interfaces that stay
        inspectable.
      </p>
      <div className="mb-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:justify-start">
        {links.map((l) => (
          <Link
            key={l.href}
            className="text-foreground/80 underline-offset-4 hover:text-foreground hover:underline"
            href={l.href}
          >
            {l.label}
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
        {stack.map((s) => (
          <span
            key={s}
            className={cn(
              "rounded-md border border-border/50 px-2 py-0.5 text-xs text-muted-foreground",
              glass({ border: "none", opaque: true })
            )}
          >
            {s}
          </span>
        ))}
      </div>
    </>
  );

  return (
    <Tag
      aria-label={intro ? "Organic LLM overview and links" : undefined}
      className={cn(
        "text-center text-sm text-muted-foreground sm:text-left",
        intro ? "mb-10" : "mt-16 border-t border-border/60 pb-8 pt-10",
        className
      )}
      role={intro ? "region" : undefined}
    >
      {intro ? (
        <div
          className={cn(
            "rounded-2xl border border-border/60 p-5 shadow-sm sm:p-6",
            glass({ border: "none" })
          )}
        >
          {body}
        </div>
      ) : (
        body
      )}
    </Tag>
  );
}
