"use client";

import type { RabbitHoleSourceAnalysis } from "@/lib/schemas/rabbitHoleSchemas";

import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import Link from "next/link";

import { RabbitHoleTTSButton } from "./RabbitHoleTTSButton";

import { cn } from "@/lib/utils";
import {
  title as titleToken,
  card,
  sourceAnalysis as sa,
} from "@/lib/rabbit-holes/tokens";

interface RabbitHoleSourceAnalysisProps {
  analysis: RabbitHoleSourceAnalysis;
  sourceId: string;
  onBack?: () => void;
  /** Compact header + typography for mobile overlay */
  mobile?: boolean;
}

export function RabbitHoleSourceAnalysis({
  analysis,
  sourceId,
  onBack,
  mobile = false,
}: RabbitHoleSourceAnalysisProps) {
  const ttsText = [analysis.title, analysis.summary].join(". ");

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={cn("mx-auto", mobile ? "max-w-none" : "max-w-2xl")}
      exit={{ opacity: 0, y: -20 }}
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {/* Header with back button and source link */}
      <div
        className={cn(
          "flex gap-4",
          mobile ? "mb-6 flex-col items-stretch" : "mb-8 items-start justify-between"
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="snap-start scroll-mt-2 mb-3">
            <h1
              className={cn(
                titleToken.base,
                mobile ? titleToken.compact : titleToken.desktop
              )}
            >
              {analysis.title}
            </h1>
          </div>
          {onBack && !mobile && (
            <button
              className="mb-4 text-sm text-muted-foreground transition-colors hover:text-foreground"
              type="button"
              onClick={onBack}
            >
              ← Back to article
            </button>
          )}
          <div className="snap-start scroll-mt-2 max-w-lg">
            <RabbitHoleTTSButton nodeId={`source-${sourceId}`} text={ttsText} />
          </div>
        </div>
        <Link
          className={cn(
            "flex items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-xs text-foreground transition-all hover:bg-card/50",
            "min-h-11 shrink-0",
            mobile && "w-full"
          )}
          href={analysis.originalUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          <span>Visit Source</span>
          <ExternalLink size={12} />
        </Link>
      </div>

      {/* Summary */}
      <div className="snap-start scroll-mt-2 mb-8">
        <h2 className={cn(sa.sectionHeader.base, mobile ? sa.sectionHeader.compact : sa.sectionHeader.desktop)}>
          Summary
        </h2>
        <p className={cn(sa.bodyText.base, mobile ? sa.bodyText.compact : sa.bodyText.desktop)}>
          {analysis.summary}
        </p>
      </div>

      {/* Key Points */}
      <div className="snap-start scroll-mt-2 mb-8 flex flex-col">
        <h2 className={cn(sa.sectionHeader.base, mobile ? sa.sectionHeader.compact : sa.sectionHeader.desktop)}>
          Key Points
        </h2>
        <ul className={mobile ? sa.keyPointListGap.compact : sa.keyPointListGap.desktop}>
          {analysis.keyPoints.map((point, index) => (
            <motion.li
              key={index}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                sa.keyPointItem.base,
                mobile ? sa.keyPointItem.compact : sa.keyPointItem.desktop
              )}
              initial={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <div className="flex flex-col gap-0.5">
                <span className="flex-1 font-medium">
                  {point.split(":")[0].replace(":", "").trim()}
                </span>
                <span className="flex-1 leading-normal">
                  {point.includes(":") ? point.slice(point.indexOf(":") + 1).trim() : point}
                </span>
              </div>
            </motion.li>
          ))}
        </ul>
      </div>

      {/* Relevance */}
      <div
        className={cn(
          "snap-start scroll-mt-2",
          card,
          mobile ? sa.relevanceCard.compact : sa.relevanceCard.desktop
        )}
      >
        <h2 className={cn(sa.sectionHeader.base, "mb-4", mobile ? sa.sectionHeader.compact : sa.sectionHeader.desktop)}>
          Relevance
        </h2>
        <p className={cn(sa.bodyText.base, mobile ? sa.bodyText.compact : sa.bodyText.desktop)}>
          {analysis.relevance}
        </p>
      </div>
    </motion.div>
  );
}
