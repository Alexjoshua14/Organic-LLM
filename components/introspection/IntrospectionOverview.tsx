"use client";

import { forwardRef } from "react";

import { ChatMessageMarkdown } from "@/components/chat/chat-message-markdown";
import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

type IntrospectionOverviewProps = {
  markdown: string;
  className?: string;
};

export const IntrospectionOverview = forwardRef<HTMLDivElement, IntrospectionOverviewProps>(
  function IntrospectionOverview({ markdown, className }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          glass(),
          "relative min-h-0 flex-1 overflow-y-auto rounded-xl border border-border/50 p-6 md:p-10",
          className
        )}
      >
        <div
          className={cn(
            "prose prose-lg dark:prose-invert w-full max-w-none",
            "text-foreground [&_h1]:text-3xl [&_h2]:text-2xl [&_h3]:text-xl",
            "[&_p]:leading-relaxed [&_li]:leading-relaxed"
          )}
        >
          {markdown.trim() ? (
            <ChatMessageMarkdown content={markdown} id="introspection-overview" />
          ) : (
            <p className="text-muted-foreground not-prose m-0 text-lg">
              Your guide will appear here shortly…
            </p>
          )}
        </div>
      </div>
    );
  }
);
