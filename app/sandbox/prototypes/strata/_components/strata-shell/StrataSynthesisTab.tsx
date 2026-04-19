"use client";

import type { RefObject } from "react";
import type { StrataPageWithSections } from "@/lib/schemas/strata";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion } from "framer-motion";

import { StrataElaboratedTTSBar } from "../StrataElaboratedTTSBar";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

export function StrataSynthesisTab({
  elaboratedRef,
  sections,
  isGenerating,
  onPersistElaboratedJson,
}: {
  elaboratedRef: RefObject<HTMLElement | null>;
  sections: StrataPageWithSections["sections"];
  isGenerating: boolean;
  onPersistElaboratedJson: (next: Record<string, unknown> | null) => Promise<void>;
}) {
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
      <div className="shrink-0">
        <StrataElaboratedTTSBar
          contentJson={sections.elaborated.contentJson}
          disabled={isGenerating}
          markdown={sections.elaborated.content}
          onPersist={onPersistElaboratedJson}
        />
      </div>
      <article className="prose prose-neutral min-h-0 flex-1 overflow-y-auto text-foreground dark:prose-invert">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {sections.elaborated.content || "No elaborated content yet."}
        </ReactMarkdown>
      </article>
    </motion.section>
  );
}
