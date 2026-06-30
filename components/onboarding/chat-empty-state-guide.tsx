"use client";

import Link from "next/link";
import { ArrowRight, MessageSquare, Sparkles } from "lucide-react";

import { FeatureHint } from "@/components/onboarding/feature-hint";
import { glassPreview } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

type ChatEmptyStateGuideProps = {
  className?: string;
};

/**
 * Default empty state for main chat — layout content only; tip is a toast via {@link FeatureHint}.
 */
export function ChatEmptyStateGuide({ className }: ChatEmptyStateGuideProps) {
  return (
    <FeatureHint id="chat-empty-state">
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
          Search and Memory are on by default — your thread can use web results and past context.
          Pick a model or leave Auto to route per message.
        </p>
        <Link
          className={cn(
            "mt-5 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors",
            "hover:bg-muted/30 hover:text-foreground"
          )}
          href="/showcase/anatomy"
        >
          <Sparkles aria-hidden className="size-3.5 text-lumen" />
          See one turn unpacked
          <ArrowRight aria-hidden className="size-3.5" strokeWidth={1.5} />
        </Link>
      </div>
    </FeatureHint>
  );
}
