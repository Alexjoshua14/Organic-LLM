"use client";

import MemoryList from "@/components/archetype/interfaces/memory";
import { glass } from "@/components/design-system/primitives";
import { ScrollArea } from "@/components/third-party/ui/scroll-area";
import { cn } from "@/lib/utils";
import { MemoryItem } from "mem0ai/oss";
import { ArchetypePayload } from "@/packages/organic-ui/src/schemas/archetype";
import { useMemo, useState } from "react";
import { sampleMemories } from "@/test-data/sampleData";

type ArchetypeHostProps = {
  showGlass?: boolean;
  opaque?: boolean;
  border?: "all" | "left" | "right" | "none";
  className?: string;
};

const initialSampleMemories: MemoryItem[] = sampleMemories[0].results;

const sampleArchetypeData: ArchetypePayload = {
  id: "a27b9c91-4e03-40e7-b7a6-14f77b32b709",
  kind: 'memory',
  memories: initialSampleMemories,
}

const ArchetypeComponent = ({ archetypeData }: { archetypeData: ArchetypePayload }) => {
  switch (archetypeData.kind) {
    case "memory":
      return (
        <ScrollArea className="h-full w-full pr-6">
          <MemoryList memories={archetypeData.memories} />
        </ScrollArea>
      );
    default:
      return null;
  }
};

export function ArchetypeHost({
  showGlass = true,
  opaque = false,
  border = "left",
  className,
}: ArchetypeHostProps) {

  // TODO: Transition this to context
  const [archetypeData, setArchetypeData] = useState<ArchetypePayload>(sampleArchetypeData);

  return (
    <aside
      className={cn(
        showGlass && glass({ border, opaque }),
        "min-w-72",
        "w-full",
        "max-w-lg",
        "h-full",
        "px-4",
        "pt-14",
        "pb-6",
        "flex",
        "flex-col",
        "gap-3",
        className
      )}
    >
      <div className="text-xs uppercase tracking-wide text-foreground/60">
        {archetypeData.kind}
      </div>

      <div className="h-full pt-6 pb-12">
        <ArchetypeComponent archetypeData={archetypeData} />
      </div>

    </aside >
  );
}

