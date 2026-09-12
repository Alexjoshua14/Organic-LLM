"use client";

import type { ReactNode } from "react";

import type { AlignmentData } from "@/lib/schemas/tts";

import { cn } from "@/lib/utils";

function buildHighlightedNodes(args: {
  text: string;
  alignment: AlignmentData | null | undefined;
  activeIndices: Set<number>;
}): ReactNode {
  const { text, alignment, activeIndices } = args;

  if (!alignment || activeIndices.size === 0) {
    return <span>{text}</span>;
  }

  const chars = alignment.characters;
  const nodes: ReactNode[] = [];

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const highlighted = activeIndices.has(i);

    nodes.push(
      <span
        key={i}
        className={cn(
          "transition-colors duration-75",
          highlighted
            ? "text-foreground"
            : "text-muted-foreground/70"
        )}
      >
        {char}
      </span>
    );
  }

  if (nodes.length === 0) {
    return <span>{text}</span>;
  }

  return <>{nodes}</>;
}

export function KaraokeCaption({
  text,
  role,
  interim,
  alignment,
  activeIndices,
  className,
}: {
  text: string;
  role: "user" | "assistant" | "system";
  interim?: boolean;
  alignment?: AlignmentData | null;
  activeIndices?: Set<number>;
  className?: string;
}) {
  if (!text) return null;

  const roleLabel =
    role === "user" ? "You" : role === "assistant" ? "Organic" : "";

  return (
    <div
      className={cn(
        "mx-auto max-w-2xl text-center transition-opacity duration-500",
        interim && "opacity-70",
        className
      )}
    >
      {roleLabel ? (
        <p className="mb-2 text-2xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          {roleLabel}
        </p>
      ) : null}
      <p
        className={cn(
          "font-commissioner text-lg font-light leading-relaxed sm:text-xl md:text-2xl",
          role === "assistant" && "text-foreground",
          role === "user" && "text-foreground/90",
          role === "system" && "text-muted-foreground text-base"
        )}
      >
        {role === "assistant" && alignment && activeIndices
          ? buildHighlightedNodes({ text, alignment, activeIndices })
          : text}
      </p>
    </div>
  );
}
