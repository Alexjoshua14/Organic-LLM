"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RabbitHoleBranchSuggestion } from "../_lib/types";
import { ChevronDown, ChevronUp } from "lucide-react";
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
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(
    new Set(),
  );

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
        "bg-white/80 dark:bg-[#1C1E1F]/80 backdrop-blur-sm rounded-lg border border-[#DCDDDC] dark:border-[#2A2C2D] shadow-sm",
        "flex flex-col overflow-hidden",
        hasSources ? "h-1/2" : "flex-1",
      )}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between p-4 hover:bg-white/30 dark:hover:bg-[#1C1E1F]/30 transition-colors"
      >
        <h2 className="font-commissioner text-xs uppercase tracking-[0.2em] text-[#5C5E5E] dark:text-[#A0A2A2] font-light">
          Explore Further
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
              {branches.map((branch, index) => {
                const isDescriptionExpanded = expandedDescriptions.has(branch.id);

                return (
                  <motion.div
                    key={branch.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.3,
                      delay: index * 0.05,
                      type: "spring",
                      stiffness: 300,
                      damping: 30,
                    }}
                    className="border border-[#DCDDDC]/50 dark:border-[#2A2C2D]/50 rounded-md overflow-hidden"
                  >
                    <div className="flex items-start gap-2">
                      <motion.button
                        onClick={() => !isLoading && onBranchClick(branch.id)}
                        disabled={isLoading}
                        className={cn(
                          "flex-1 text-left px-3 py-2 rounded-md transition-all",
                          "hover:bg-white/50 dark:hover:bg-[#1C1E1F]/50",
                          "disabled:opacity-50 disabled:cursor-not-allowed",
                        )}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <p className="font-satoshi text-sm font-medium text-[#2D2B26] dark:text-[#F3F4F3]">
                          {branch.label}
                        </p>
                      </motion.button>
                      {branch.shortDescription && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDescription(branch.id);
                          }}
                          className="p-2 hover:bg-white/30 dark:hover:bg-[#1C1E1F]/30 transition-colors shrink-0"
                        >
                          {isDescriptionExpanded ? (
                            <ChevronUp
                              size={14}
                              className="text-[#5C5E5E] dark:text-[#A0A2A2]"
                            />
                          ) : (
                            <ChevronDown
                              size={14}
                              className="text-[#5C5E5E] dark:text-[#A0A2A2]"
                            />
                          )}
                        </button>
                      )}
                    </div>
                    <AnimatePresence>
                      {isDescriptionExpanded && branch.shortDescription && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <p className="px-3 pb-2 font-satoshi text-xs text-[#5C5E5E]/70 dark:text-[#A0A2A2]/70 leading-relaxed">
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

