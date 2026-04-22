"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";

const links = [
  { href: "/chat", label: "Chat" },
  { href: "/sandbox/arcadia", label: "Arcadia" },
  { href: "/sandbox/prototypes/strata", label: "Strata" },
  { href: "/rabbitholes/browse", label: "Rabbit holes" },
  { href: "/showcase", label: "Showcase" },
] as const;

const stack = ["Next.js", "React", "AI SDK", "Clerk", "Supabase"];

type ShowcaseFooterProps = {
  className?: string;
};

export function ShowcaseFooter({ className }: ShowcaseFooterProps) {
  return (
    <footer
      className={cn(
        "mt-16 border-t border-border/60 pt-10 pb-8 text-center text-sm text-muted-foreground sm:text-left",
        className
      )}
    >
      <p className="mb-6 max-w-2xl mx-auto sm:mx-0 leading-relaxed">
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
            className="rounded-md border border-border/60 bg-background/40 px-2 py-0.5 text-xs text-muted-foreground"
          >
            {s}
          </span>
        ))}
      </div>
    </footer>
  );
}
