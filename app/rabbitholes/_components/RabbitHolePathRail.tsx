"use client";

import { motion } from "framer-motion";
import { RabbitHoleSession, RabbitHoleNodeId } from "../_lib/types";
import { cn } from "@/lib/utils";

interface RabbitHolePathRailProps {
  session: RabbitHoleSession | null;
  activeNodeId: RabbitHoleNodeId | null;
  generatingNodeId?: RabbitHoleNodeId | null;
  onNodeClick: (nodeId: RabbitHoleNodeId) => void;
  onNewRabbitHole?: () => void;
}

export function RabbitHolePathRail({
  session,
  activeNodeId,
  generatingNodeId,
  onNodeClick,
  onNewRabbitHole,
}: RabbitHolePathRailProps) {
  if (!session || session.path.length === 0) {
    return (
      <div className="bg-white/80 dark:bg-[#1C1E1F]/80 backdrop-blur-sm rounded-lg p-6 border border-[#DCDDDC] dark:border-[#2A2C2D] shadow-sm">
        <p className="font-commissioner text-xs uppercase tracking-[0.2em] text-[#5C5E5E] dark:text-[#A0A2A2] mb-3 font-light">
          Path
        </p>
        <p className="font-satoshi text-sm text-[#5C5E5E]/70 dark:text-[#A0A2A2]/70">
          No exploration yet
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white/80 dark:bg-[#1C1E1F]/80 backdrop-blur-sm rounded-lg p-6 border border-[#DCDDDC] dark:border-[#2A2C2D] shadow-sm h-full">
      <p className="font-commissioner text-xs uppercase tracking-[0.2em] text-[#5C5E5E] dark:text-[#A0A2A2] mb-6 font-light">
        Exploration Path
      </p>
      <div className="flex flex-col gap-3">
        {onNewRabbitHole && (
          <motion.button
            onClick={onNewRabbitHole}
            className={cn(
              "text-left px-4 py-3 rounded-md transition-all",
              "border-2 border-dashed border-[#DCDDDC] dark:border-[#2A2C2D]",
              "hover:bg-white/50 dark:hover:bg-[#1C1E1F]/50 hover:border-[#5C5E5E] dark:hover:border-[#A0A2A2]",
              "flex items-center gap-3",
            )}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.2,
              type: "spring",
              stiffness: 300,
              damping: 30,
            }}
          >
            <span className="text-xl text-[#5C5E5E] dark:text-[#A0A2A2]">+</span>
            <span className="font-satoshi text-sm font-medium text-[#5C5E5E] dark:text-[#A0A2A2]">
              New Rabbit Hole
            </span>
          </motion.button>
        )}
        {session.path.map((segment, index) => {
          const isActive = segment.nodeId === activeNodeId;
          const isGenerating = segment.nodeId === generatingNodeId;
          const node = session.nodesById[segment.nodeId];
          const isRoot = index === 0;
          const isSubpath = index > 0;

          return (
            <motion.button
              key={segment.nodeId}
              onClick={() => onNodeClick(segment.nodeId)}
              className={cn(
                "text-left py-3 rounded-md transition-all w-full relative pl-10 pr-4",
                "border",
                isActive
                  ? "bg-white/50 dark:bg-[#1C1E1F]/50 border-[#DCDDDC] dark:border-[#2A2C2D] shadow-sm"
                  : "border-transparent hover:bg-white/30 dark:hover:bg-[#1C1E1F]/30",
                isGenerating && "border-[#5C5E5E]/50 dark:border-[#A0A2A2]/50",
                isSubpath && "ml-4",
              )}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.2,
                delay: index * 0.05,
                type: "spring",
                stiffness: 300,
                damping: 30,
              }}
            >
              {/* Connector line and node dot */}
              <div className="absolute left-3 top-0 bottom-0 w-px bg-[#DCDDDC] dark:bg-[#2A2C2D]" />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-px bg-[#DCDDDC] dark:bg-[#2A2C2D]" />
              <div
                className={cn(
                  "absolute left-4.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full transition-colors",
                  isActive
                    ? "bg-[#2D2B26] dark:bg-[#F3F4F3]"
                    : "bg-[#5C5E5E]/50 dark:bg-[#A0A2A2]/50",
                )}
              />

              <div className="flex flex-col">
                <p
                  className={cn(
                    "font-satoshi leading-relaxed",
                    isRoot ? "text-sm" : "text-xs",
                    isActive
                      ? "text-[#2D2B26] dark:text-[#F3F4F3] font-medium"
                      : "text-[#5C5E5E] dark:text-[#A0A2A2]",
                  )}
                >
                  {segment.label}
                </p>
                {node && (
                  <p className="font-satoshi text-xs text-[#5C5E5E]/70 dark:text-[#A0A2A2]/70 mt-1">
                    {isRoot ? "Root" : `Branch ${index}`}
                  </p>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

