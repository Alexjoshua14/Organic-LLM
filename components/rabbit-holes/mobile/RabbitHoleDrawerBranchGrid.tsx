"use client";

import type {
  RabbitHoleBranchSuggestion,
  RabbitHoleSession,
} from "@/lib/schemas/rabbitHoleSchemas";

import { ChevronLeft } from "lucide-react";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

const MAX_VISIBLE_BRANCHES = 5;
const ROW_START = ["row-start-1", "row-start-2", "row-start-3", "row-start-4", "row-start-5"] as const;

export interface RabbitHoleDrawerBranchGridProps {
  session: RabbitHoleSession | null;
  branches: RabbitHoleBranchSuggestion[];
  activeNodeId: string | null;
  isLoading: boolean;
  canGoBack: boolean;
  onNavigateBack: () => void;
  onBranchClick: (branchId: string) => void;
  className?: string;
}

function getParentLabel(session: RabbitHoleSession | null, activeNodeId: string | null): string {
  if (!session || !activeNodeId) return "Parent";

  const idx = session.path.findIndex((s) => s.nodeId === activeNodeId);

  if (idx <= 0) return "Parent";

  const parentId = session.path[idx - 1]?.nodeId;
  const parent = parentId ? session.nodesById[parentId] : null;

  return parent?.title?.trim() || session.path[idx - 1]?.label || "Parent";
}

export function RabbitHoleDrawerBranchGrid({
  session,
  branches,
  activeNodeId,
  isLoading,
  canGoBack,
  onNavigateBack,
  onBranchClick,
  className,
}: RabbitHoleDrawerBranchGridProps) {
  const visible = branches.slice(0, MAX_VISIBLE_BRANCHES);
  const showParent = canGoBack && session && activeNodeId;

  if (!showParent && visible.length === 0) return null;

  return (
    <div className={cn("mt-3", className)}>
      <p className="font-commissioner mb-2 text-[10px] font-light uppercase tracking-[0.2em] text-muted-foreground">
        Explore further
      </p>
      <div
        className={cn(
          "grid min-h-[12rem] grid-cols-6 grid-rows-6 gap-2",
          branches.length > MAX_VISIBLE_BRANCHES && "max-h-64 overflow-y-auto"
        )}
      >
        {showParent ? (
          <button
            className={cn(
              "col-span-1 row-span-6 flex min-h-0 flex-col items-center justify-center gap-1 rounded-xl border border-border/50 px-1 py-2 text-center text-xs font-medium",
              glass({ opaque: true }),
              "transition-colors active:bg-card/80 disabled:opacity-40"
            )}
            disabled={isLoading}
            type="button"
            onClick={onNavigateBack}
          >
            <ChevronLeft aria-hidden className="size-4 shrink-0" />
            <span className="line-clamp-4 [writing-mode:vertical-rl] rotate-180">
              {getParentLabel(session, activeNodeId)}
            </span>
          </button>
        ) : null}

        {visible.map((branch, index) => (
          <button
            key={branch.id}
            className={cn(
              "col-span-5 flex min-h-11 items-center justify-between gap-2 rounded-xl border border-border/50 px-3 py-2 text-left text-sm font-medium",
              glass({ opaque: true }),
              showParent ? `col-start-2 ${ROW_START[index] ?? "row-start-1"}` : `col-start-1 ${ROW_START[index] ?? "row-start-1"}`,
              !showParent && "col-span-6",
              "transition-colors active:bg-card/80 disabled:opacity-40"
            )}
            disabled={isLoading}
            type="button"
            onClick={() => onBranchClick(branch.id)}
          >
            <span className="min-w-0">
              <span className="line-clamp-1">{branch.label}</span>
              {branch.shortDescription ? (
                <span className="line-clamp-1 text-xs font-normal text-muted-foreground">
                  {branch.shortDescription}
                </span>
              ) : null}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
