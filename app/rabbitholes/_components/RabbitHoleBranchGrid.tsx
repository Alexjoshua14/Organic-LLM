"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";

import { RabbitHoleBranchSuggestion } from "@/lib/schemas/rabbitHoleSchemas";
import { cn } from "@/lib/utils";

interface RabbitHoleBranchGridProps {
  branches: RabbitHoleBranchSuggestion[];
  onBranchClick: (branchId: string) => void;
  isLoading: boolean;
  hasSources?: boolean;
}

export function RabbitHoleBranchGrid({
  branches,
  onBranchClick,
  isLoading,
  hasSources = false,
}: RabbitHoleBranchGridProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());

  const toggleDescription = (branchId: string) => {
    setExpandedDescriptions((prev) => {
      const next = new Set(prev);

      if (next.has(branchId)) {
        next.delete(branchId);
      } else {
        next.add(branchId);
      }

      return next;
    });
  };

  return (
    <div
      className={cn(
        "bg-card/80 backdrop-blur-sm rounded-lg border border-border shadow-sm",
        "flex flex-col overflow-hidden",
        hasSources ? "h-1/2" : "flex-1"
      )}
    >
      <button
        className="flex items-center justify-between p-4 hover:bg-card/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h2 className="font-commissioner text-xs uppercase tracking-[0.2em] text-muted-foreground font-light">
          Explore Further
        </h2>
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
            className="flex-1 overflow-hidden flex flex-col min-h-0"
            exit={{ height: 0 }}
            initial={{ height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-4 pb-4 space-y-2 overflow-y-auto flex-1">
              {branches.map((branch, index) => {
                const isDescriptionExpanded = expandedDescriptions.has(branch.id);

                return (
                  <motion.div
                    key={branch.id}
                    animate={{ opacity: 1, x: 0 }}
                    className="border border-border/50 rounded-md overflow-hidden"
                    initial={{ opacity: 0, x: 20 }}
                    transition={{
                      duration: 0.3,
                      delay: index * 0.05,
                      type: "spring",
                      stiffness: 300,
                      damping: 30,
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <motion.button
                        className={cn(
                          "flex-1 text-left px-3 py-2 rounded-md transition-all",
                          "hover:bg-card/50",
                          "disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                        disabled={isLoading}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => !isLoading && onBranchClick(branch.id)}
                      >
                        <p className="font-satoshi text-sm font-medium text-foreground">
                          {branch.label}
                        </p>
                      </motion.button>
                      {branch.shortDescription && (
                        <button
                          className="p-2 hover:bg-card/30 transition-colors shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDescription(branch.id);
                          }}
                        >
                          {isDescriptionExpanded ? (
                            <ChevronUp className="text-muted-foreground" size={14} />
                          ) : (
                            <ChevronDown className="text-muted-foreground" size={14} />
                          )}
                        </button>
                      )}
                    </div>
                    <AnimatePresence>
                      {isDescriptionExpanded && branch.shortDescription && (
                        <motion.div
                          animate={{ height: "auto", opacity: 1 }}
                          className="overflow-hidden"
                          exit={{ height: 0, opacity: 0 }}
                          initial={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <p className="px-3 pb-2 text-xs text-muted-foreground/70 leading-relaxed">
                            {branch.shortDescription}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
