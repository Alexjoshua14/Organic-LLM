"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RabbitHoleSource } from "@/lib/schemas/rabbitHoleSchemas";
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
        "bg-card/80 backdrop-blur-sm rounded-lg border border-border shadow-sm",
        "flex flex-col overflow-hidden",
        hasBranches ? "h-1/2 mb-3" : "flex-1",
      )}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between p-4 hover:bg-card/30 transition-colors"
      >
        <h2 className="font-commissioner text-xs uppercase tracking-[0.2em] text-muted-foreground font-light">
          Sources
        </h2>
        {isExpanded ? (
          <ChevronUp size={16} className="text-muted-foreground" />
        ) : (
          <ChevronDown size={16} className="text-muted-foreground" />
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
                      "border border-border/50",
                      "hover:bg-card/50 hover:border-border",
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
                      <p className="text-xs text-foreground group-hover:text-muted-foreground transition-colors line-clamp-1 flex-1 min-w-0">
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

