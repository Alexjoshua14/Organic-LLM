"use client";

import { MessageSquare } from "lucide-react";

import { glassPreview } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

type ChatEmptyStateGuideProps = {
  className?: string;
};

/**
 * Empty state for a new main-chat thread. It is the teaching moment for this screen, so no tip
 * repeats it.
 */
export function ChatEmptyStateGuide({ className }: ChatEmptyStateGuideProps) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-md flex-col items-center px-4 py-8 text-center sm:py-10",
        className
      )}
    >
      <div
        className={cn(
          "mb-5 flex size-14 items-center justify-center rounded-2xl",
          glassPreview({ opaque: true, depth: "raised" })
        )}
      >
        <MessageSquare aria-hidden className="size-7 text-lumen" strokeWidth={1.25} />
      </div>
      <h2 className="font-commissioner text-xl font-light tracking-wide text-foreground sm:text-2xl">
        Start a conversation
      </h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Search and Memory are on by default, so replies can use web results and what Organic has
        learned about you. Leave the model on Auto to have it chosen for each message.
      </p>
    </div>
  );
}
