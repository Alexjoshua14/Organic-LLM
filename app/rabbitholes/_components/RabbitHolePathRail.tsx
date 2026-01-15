"use client";

import { motion } from "framer-motion";
import { RabbitHoleSession, RabbitHoleNodeId } from "@/lib/schemas/rabbitHoleSchemas";
import { cn } from "@/lib/utils";

function NewRabbitHoleButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      className={cn(
        "text-left px-4 py-3 rounded-md transition-all cursor-pointer",
        "border-2 border-dashed border-border",
        "hover:bg-card/50 hover:border-muted-foreground",
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
      <span className="text-xl text-muted-foreground">+</span>
      <span className="text-sm font-medium text-muted-foreground">
        New Rabbit Hole
      </span>
    </motion.button>
  );
}

interface PathRailItemProps {
  segment: { nodeId: string; label: string };
  nodeLabel?: string;
  isActive: boolean;
  isGenerating: boolean;
  depth: number;
  index: number;
  onClick: () => void;
}

function PathRailItem({
  segment,
  nodeLabel,
  isActive,
  isGenerating,
  depth,
  index,
  onClick,
}: PathRailItemProps) {
  return (
    <motion.button
      key={segment.nodeId}
      onClick={onClick}
      className={cn(
        "text-left py-3 rounded-md transition-all w-full relative pl-10 pr-4",
        "border",
        isActive
          ? "bg-card/50 border-border shadow-sm"
          : "border-transparent hover:bg-card/30 cursor-pointer",
        isGenerating && "border-muted-foreground/50",
        depth > 0 && "ml-4",
      )}
      style={{ marginLeft: depth > 0 ? depth * 12 : 0 }}
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
      <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
      <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-px bg-border" />
      <div
        className={cn(
          "absolute left-4.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full transition-colors",
          isActive
            ? "bg-foreground"
            : "bg-muted-foreground/50",
        )}
      />

      <div className="flex flex-col pl-4">
        <p
          className={cn(
            "leading-relaxed",
            depth === 0 ? "text-sm" : "text-xs",
            isActive
              ? "text-foreground font-medium"
              : "text-muted-foreground",
          )}
        >
          {segment.label}
        </p>
        {nodeLabel && (
          <p className="text-xs text-muted-foreground/70 mt-1">
            {nodeLabel}
          </p>
        )}
      </div>
    </motion.button>
  );
}

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
      <div className="bg-card/80 backdrop-blur-sm rounded-lg p-6 border border-border shadow-sm">
        <p className="font-commissioner text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 font-light">
          Path
        </p>
        <p className="text-sm text-muted-foreground/70">
          No exploration yet
        </p>
      </div>
    );
  }

  const findSegment = (nodeId: string) =>
    [...session.path].reverse().find((seg) => seg.nodeId === nodeId);

  const depthCache = new Map<string, number>();
  const computeDepth = (nodeId: string, visited: Set<string> = new Set()): number => {
    if (depthCache.has(nodeId)) return depthCache.get(nodeId)!;
    if (visited.has(nodeId)) return 0; // cycle guard
    visited.add(nodeId);

    const seg = findSegment(nodeId);
    if (!seg || !seg.parentNodeId) {
      depthCache.set(nodeId, 0);
      return 0;
    }
    const parentDepth = computeDepth(seg.parentNodeId, visited);
    const depth = parentDepth + 1;
    depthCache.set(nodeId, depth);
    return depth;
  };

  return (
    <div className="bg-card/80 backdrop-blur-sm rounded-lg p-6 border border-border shadow-sm h-full">
      <p className="font-commissioner text-xs uppercase tracking-[0.2em] text-muted-foreground mb-6 font-light">
        Exploration Path
      </p>
      <div className="flex flex-col gap-3">
        {onNewRabbitHole && (
          <NewRabbitHoleButton onClick={onNewRabbitHole} />
        )}
        {session.path.map((segment, index) => {
          const isActive = segment.nodeId === activeNodeId;
          const isGenerating = segment.nodeId === generatingNodeId;
          const node = session.nodesById[segment.nodeId];
          const depth = computeDepth(segment.nodeId);
          const nodeLabel = node ? (depth === 0 ? "Root" : `Level ${depth}`) : undefined;

          return (
            <PathRailItem
              key={segment.nodeId}
              segment={segment}
              nodeLabel={nodeLabel}
              isActive={isActive}
              isGenerating={isGenerating}
              depth={depth}
              index={index}
              onClick={() => onNodeClick(segment.nodeId)}
            />
          );
        })}
      </div>
    </div>
  );
}

