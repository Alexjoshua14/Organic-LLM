"use client";

import { motion } from "framer-motion";
import type { RabbitHoleSourceAnalysis } from "../_lib/types";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { RabbitHoleTTSButton } from "./RabbitHoleTTSButton";

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
    ...analysis.keyPoints,
    analysis.relevance,
  ].join(". ");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      className="max-w-2xl mx-auto"
    >
      {/* Header with back button and source link */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="mb-3">
            <h1 className="font-commissioner text-3xl font-light tracking-tight text-[#2D2B26] dark:text-[#F3F4F3]">
              {analysis.title}
            </h1>
          </div>
          {onBack && (
            <button
              onClick={onBack}
              className="font-satoshi text-sm text-[#5C5E5E] dark:text-[#A0A2A2] hover:text-[#2D2B26] dark:hover:text-[#F3F4F3] transition-colors mb-4"
            >
              ← Back to article
            </button>
          )}
          <div className="max-w-lg">
            <RabbitHoleTTSButton nodeId={`source-${sourceId}`} text={ttsText} />
          </div>
        </div>
        <a
          href={analysis.originalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-md transition-all",
            "border border-[#DCDDDC] dark:border-[#2A2C2D]",
            "hover:bg-white/50 dark:hover:bg-[#1C1E1F]/50",
            "font-satoshi text-sm text-[#2D2B26] dark:text-[#F3F4F3]",
            "shrink-0",
          )}
        >
          <span>Visit Source</span>
          <ExternalLink size={14} />
        </a>
      </div>

      {/* Summary */}
      <div className="mb-8">
        <h2 className="font-commissioner text-xl font-light text-[#2D2B26] dark:text-[#F3F4F3] mb-4">
          Summary
        </h2>
        <p className="font-satoshi text-lg leading-relaxed text-[#5C5E5E] dark:text-[#A0A2A2]">
          {analysis.summary}
        </p>
      </div>

      {/* Key Points */}
      <div className="mb-8">
        <h2 className="font-commissioner text-xl font-light text-[#2D2B26] dark:text-[#F3F4F3] mb-4">
          Key Points
        </h2>
        <ul className="space-y-3">
          {analysis.keyPoints.map((point, index) => (
            <motion.li
              key={index}
              className="flex items-start gap-4 font-satoshi text-base leading-relaxed text-[#5C5E5E] dark:text-[#A0A2A2]"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.3,
                delay: index * 0.1,
              }}
            >
              <span className="mt-1 shrink-0 text-[#5C5E5E] dark:text-[#A0A2A2]">
                •
              </span>
              <span className="flex-1">{point}</span>
            </motion.li>
          ))}
        </ul>
      </div>

      {/* Relevance */}
      <div className="bg-white/80 dark:bg-[#1C1E1F]/80 backdrop-blur-sm rounded-lg p-6 border border-[#DCDDDC] dark:border-[#2A2C2D]">
        <h2 className="font-commissioner text-xl font-light text-[#2D2B26] dark:text-[#F3F4F3] mb-3">
          Relevance
        </h2>
        <p className="font-satoshi text-base leading-relaxed text-[#5C5E5E] dark:text-[#A0A2A2]">
          {analysis.relevance}
        </p>
      </div>
    </motion.div>
  );
}

