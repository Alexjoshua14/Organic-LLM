"use client";

import type { RabbitHoleSourceAnalysis } from "@/lib/schemas/rabbitHoleSchemas";

import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import Link from "next/link";

import { RabbitHoleTTSButton } from "./RabbitHoleTTSButton";

import { cn } from "@/lib/utils";

const rabbitHoleSectionHeaderClass = "font-commissioner text-xl font-light text-foreground mb-4";

interface RabbitHoleSourceAnalysisProps {
  analysis: RabbitHoleSourceAnalysis;
  sourceId: string;
  onBack?: () => void;
}

export function RabbitHoleSourceAnalysis({
  analysis,
  sourceId,
  onBack,
}: RabbitHoleSourceAnalysisProps) {
  // Combine all text content for TTS
  const ttsText = [
    analysis.title,
    analysis.summary,
    // ...analysis.keyPoints,
    // analysis.relevance,
  ].join(". ");

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
      exit={{ opacity: 0, y: -20 }}
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {/* Header with back button and source link */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="mb-3">
            <h1 className="font-commissioner text-3xl font-light tracking-tight text-foreground">
              {analysis.title}
            </h1>
          </div>
          {onBack && (
            <button
              className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
              onClick={onBack}
            >
              ← Back to article
            </button>
          )}
          <div className="max-w-lg">
            <RabbitHoleTTSButton nodeId={`source-${sourceId}`} text={ttsText} />
          </div>
        </div>
        <Link
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-md transition-all",
            "border border-border",
            "hover:bg-card/50",
            "text-xs text-foreground",
            "shrink-0"
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
      <div className="mb-8">
        <h2 className={rabbitHoleSectionHeaderClass}>Summary</h2>
        <p className="text-base leading-relaxed text-muted-foreground">{analysis.summary}</p>
      </div>

      {/* Key Points */}
      <div className="mb-8 flex flex-col">
        <h2 className={rabbitHoleSectionHeaderClass}>Key Points</h2>
        <ul className="space-y-6">
          {analysis.keyPoints.map((point, index) => (
            <motion.li
              key={index}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-start gap-4 pl-2 text-base text-muted-foreground"
              initial={{ opacity: 0, x: -10 }}
              transition={{
                duration: 0.3,
                delay: index * 0.1,
              }}
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
      <div className="bg-card/80 backdrop-blur-sm rounded-lg p-6 border border-border">
        <h2 className={cn(rabbitHoleSectionHeaderClass, "mb-4")}>Relevance</h2>
        <p className="text-base leading-relaxed text-muted-foreground">{analysis.relevance}</p>
      </div>
    </motion.div>
  );
}
