"use client";

import type { RefObject } from "react";
import type { StrataPageWithSections } from "@/lib/schemas/strata";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion } from "framer-motion";

import {
  StrataElaboratedSummaryTTSBar,
  StrataElaboratedVerbatimTTSBar,
} from "../StrataElaboratedTTSBar";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

export function StrataSynthesisTab({
  elaboratedRef,
  pageId,
  sections,
  isGenerating,
  onPersistElaboratedJson,
}: {
  elaboratedRef: RefObject<HTMLElement | null>;
  pageId: string;
  sections: StrataPageWithSections["sections"];
  isGenerating: boolean;
  onPersistElaboratedJson: (next: Record<string, unknown> | null) => Promise<void>;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [isTtsPinned, setIsTtsPinned] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let observer: IntersectionObserver | null = null;

    const attach = () => {
      const root = scrollRef.current;
      const sentinel = sentinelRef.current;

      if (!root || !sentinel || cancelled) return;

      observer?.disconnect();
      observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry) return;
          setIsTtsPinned(!entry.isIntersecting);
        },
        { root, threshold: 0 }
      );
      observer.observe(sentinel);
    };

    attach();
    const raf = requestAnimationFrame(attach);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [pageId, sections.elaborated.content, isGenerating]);

  return (
    <motion.section
      ref={elaboratedRef}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      initial={{ opacity: 0, y: 16, scale: 0.99 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl px-4 py-4 sm:px-6 sm:py-6",
        glass({ tone: "brown", opaque: true }),
        "border border-border/60 backdrop-blur-xl"
      )}
    >
      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain"
      >
        <div ref={sentinelRef} aria-hidden className="h-px w-full shrink-0 pointer-events-none" />
        <div
          className={cn(
            "sticky top-0 z-10 -mx-1 shrink-0 border-b border-border/50 px-1 py-1 sm:-mx-2 sm:px-2",
            glass({ tone: "brown", opaque: true }),
            isTtsPinned && "shadow-sm"
          )}
        >
          <StrataElaboratedSummaryTTSBar
            compact={isTtsPinned}
            contentJson={sections.elaborated.contentJson}
            disabled={isGenerating}
            markdown={sections.elaborated.content}
            pageId={pageId}
            onPersist={onPersistElaboratedJson}
          />
          <StrataElaboratedVerbatimTTSBar
            compact={isTtsPinned}
            contentJson={sections.elaborated.contentJson}
            disabled={isGenerating}
            markdown={sections.elaborated.content}
            onPersist={onPersistElaboratedJson}
          />
        </div>
        <article className="prose prose-neutral px-0 pt-4 pb-6 text-foreground dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {sections.elaborated.content || "No elaborated content yet."}
          </ReactMarkdown>
        </article>
      </div>
    </motion.section>
  );
}
