"use client";

import { glass } from "@/components/design-system/primitives";

/**
 * High-level affiliation / signature line as a distinct block.
 * Uses your glass() style; left accent bar for emphasis.
 */
export function SignatureBlock({ signature }: { signature: string }) {
  if (!signature?.trim()) return null;

  return (
    <blockquote
      className={`relative overflow-hidden rounded-2xl px-6 py-5 md:px-8 md:py-6 ${glass()}`}
    >
      {/* Left accent */}
      <div
        className="absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-linear-to-b from-accent/70 to-accent/40"
        aria-hidden
      />
      <p className="font-commissioner text-base font-medium leading-snug text-foreground pl-4 md:text-lg md:leading-snug md:pl-5">
        {signature}
      </p>
    </blockquote>
  );
}
