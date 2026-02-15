"use client";

/**
 * High-level affiliation / signature line.
 * No card background — sits directly on the page with a thin accent bar.
 */
export function SignatureBlock({ signature }: { signature: string }) {
  if (!signature?.trim()) return null;

  return (
    <blockquote className="relative pl-5 md:pl-6">
      {/* Thin accent bar */}
      <div
        className="absolute left-0 top-0 h-full w-[2px] rounded-full bg-foreground/15"
        aria-hidden
      />
      <p className="font-commissioner text-sm font-medium leading-relaxed text-foreground/55 md:text-base">
        {signature}
      </p>
    </blockquote>
  );
}
