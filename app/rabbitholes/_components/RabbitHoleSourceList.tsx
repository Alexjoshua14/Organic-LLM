"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";

import { RabbitHoleSource } from "@/lib/schemas/rabbitHoleSchemas";
import { cn } from "@/lib/utils";
import { card, sectionLabel, sidebar } from "@/lib/rabbit-holes/designTokens";

interface RabbitHoleSourceListProps {
  sources: RabbitHoleSource[];
  onSourceClick?: (source: RabbitHoleSource) => void;
  hasBranches?: boolean;
}

export function RabbitHoleSourceList({
  sources,
  onSourceClick,
  hasBranches = false,
}: RabbitHoleSourceListProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (sources.length === 0) {
    return null;
  }

  return (
    <div className={cn(card, "flex flex-col overflow-hidden", hasBranches && "mb-3")}>
      <button
        className="flex items-center justify-between p-4 hover:bg-card/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h2 className={sectionLabel}>Sources</h2>
        {isExpanded ? (
          <ChevronUp className="text-muted-foreground" size={16} />
        ) : (
          <ChevronDown className="text-muted-foreground" size={16} />
        )}
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            animate={{ height: "auto" }}
            className="flex flex-col"
            exit={{ height: 0 }}
            initial={{ height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="space-y-2 px-4 pb-4">
              {sources.map((source, index) => {
                return (
                  <motion.button
                    key={source.id}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "block w-full text-left p-2 rounded-md transition-all",
                      "border border-border/50",
                      "hover:bg-card/50 hover:border-border",
                      "group"
                    )}
                    initial={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                    whileHover={{ scale: 1.01 }}
                    onClick={() => onSourceClick?.(source)}
                  >
                    <div className="flex items-center gap-2">
                      {source.faviconUrl && (
                        <img
                          alt=""
                          className={sidebar.sourceFavicon}
                          src={source.faviconUrl}
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      )}
                      <p className={sidebar.sourceTitle}>{source.title}</p>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
