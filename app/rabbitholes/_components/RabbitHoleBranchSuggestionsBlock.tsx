"use client";

import { RabbitHoleBranchGrid } from "./RabbitHoleBranchGrid";
import type { RabbitHoleBranchSuggestion } from "@/lib/schemas/rabbitHoleSchemas";

export interface RabbitHoleBranchSuggestionsBlockProps {
  branches: RabbitHoleBranchSuggestion[];
  onBranchClick: (branchId: string) => void;
  isLoading: boolean;
  hasSources?: boolean;
}

/**
 * Composes the "Explore Further" header and RabbitHoleBranchGrid.
 * Used by RabbitHoleShell and by the sandbox branch-suggestions scenario.
 */
export function RabbitHoleBranchSuggestionsBlock({
  branches,
  onBranchClick,
  isLoading,
  hasSources = false,
}: RabbitHoleBranchSuggestionsBlockProps) {
  return (
    <RabbitHoleBranchGrid
      branches={branches}
      onBranchClick={onBranchClick}
      isLoading={isLoading}
      hasSources={hasSources}
    />
  );
}
