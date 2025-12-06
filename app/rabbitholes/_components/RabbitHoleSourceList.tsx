"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RabbitHoleSource } from "../_lib/types";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <div
      className={cn(
        "bg-white/80 dark:bg-[#1C1E1F]/80 backdrop-blur-sm rounded-lg border border-[#DCDDDC] dark:border-[#2A2C2D] shadow-sm",
        "flex flex-col overflow-hidden",
        hasBranches ? "h-1/2 mb-3" : "flex-1",
      )}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between p-4 hover:bg-white/30 dark:hover:bg-[#1C1E1F]/30 transition-colors"
      >
        <h2 className="font-commissioner text-xs uppercase tracking-[0.2em] text-[#5C5E5E] dark:text-[#A0A2A2] font-light">
          Sources
        </h2>
        {isExpanded ? (
          <ChevronUp size={16} className="text-[#5C5E5E] dark:text-[#A0A2A2]" />
        ) : (
          <ChevronDown size={16} className="text-[#5C5E5E] dark:text-[#A0A2A2]" />
        )}
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 overflow-hidden flex flex-col min-h-0"
          >
            <div className="px-4 pb-4 space-y-2 overflow-y-auto flex-1">
              {sources.map((source, index) => {
                return (
                  <motion.button
                    key={source.id}
                    onClick={() => onSourceClick?.(source)}
                    className={cn(
                      "block w-full text-left p-2 rounded-md transition-all",
                      "border border-[#DCDDDC]/50 dark:border-[#2A2C2D]/50",
                      "hover:bg-white/50 dark:hover:bg-[#1C1E1F]/50 hover:border-[#DCDDDC] dark:hover:border-[#2A2C2D]",
                      "group",
                    )}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.2,
                      delay: index * 0.05,
                    }}
                    whileHover={{ scale: 1.01 }}
                  >
                    <div className="flex items-center gap-2">
                      {source.faviconUrl && (
                        <img
                          src={source.faviconUrl}
                          alt=""
                          className="w-4 h-4 shrink-0 opacity-70"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      )}
                      <p className="font-satoshi text-xs text-[#2D2B26] dark:text-[#F3F4F3] group-hover:text-[#5C5E5E] dark:group-hover:text-[#A0A2A2] transition-colors line-clamp-1 flex-1 min-w-0">
                        {source.title}
                      </p>
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

