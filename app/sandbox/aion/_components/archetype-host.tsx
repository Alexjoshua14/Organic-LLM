"use client";

import MemoryList from "@/components/archetype/interfaces/memory";
import { glass } from "@/components/design-system/primitives";
import { ScrollArea } from "@/components/third-party/ui/scroll-area";
import { cn } from "@/lib/utils";
import { MemoryItem } from "mem0ai/oss";
import { ArchetypePayload } from "@/packages/organic-ui/src/schemas/archetype";
import { useEffect } from "react";
import { sampleMemories } from "@/test-data/sampleData";
import { useArchetypeContext } from "@/lib/context/archetype-context";
import { Button } from "@/components/third-party/ui/button";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { getCurrentUserMemories } from "@/lib/memory/operations";
import { createLogger } from "@/lib/logger";

const logger = createLogger("app/sandbox/aion/_components/archetype-host.tsx");

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

const ArchetypeComponent = ({ }) => {

  const { archetypeData } = useArchetypeContext();

  if (!archetypeData) {
    return (
      <div className="h-full pt-6 pb-12">
        <p>No archetype data</p>
      </div>
    );
  }

  switch (archetypeData.kind) {
    case "memory":
      return (
        <ScrollShadow className="h-full w-full pr-6 flex-1 min-h-0">
          <MemoryList memories={archetypeData.memories} />
        </ScrollShadow>
      );
    default:
      return (
        <div className="h-full pt-6 pb-12">
          <p>Archetype <span className="font-mono">{archetypeData.kind}</span> is not yet supported</p>
        </div>
      );
  }
};

export function ArchetypeHost({
  showGlass = true,
  opaque = false,
  border = "left",
  className,
}: ArchetypeHostProps) {

  const { setArchetypeData, archetypeData } = useArchetypeContext();

  // TODO: Refactor into actual logic, this is a temporary placeholder while developing Archetypes
  useEffect(() => {
    const fetchMemories = async () => {
      if (archetypeData) return;

      const result = await getCurrentUserMemories();
      if (result.error) {
        if (result.error === "Not signed in") return;
        setArchetypeData(sampleArchetypeData);
        return;
      }
      if (result.data) {
        setArchetypeData({
          id: "f11aac23-ca87-4a79-a5a9-5c7115abec2b",
          kind: "memory" as const,
          memories: result.data.results,
        });
      }
    };

    fetchMemories();
  }, [setArchetypeData, archetypeData]);

  return (
    <aside
      className={cn(
        showGlass && glass({ border, opaque }),
        "min-w-72",
        "w-full",
        "max-w-lg",
        "h-full",
        "flex-1",
        "px-4",
        "pt-14",
        "pb-6",
        "flex",
        "flex-col",
        "gap-3",
        "min-h-0",
        className
      )}
    >
      {archetypeData ?
        <>
          <div className="text-xs uppercase tracking-wide text-foreground/60">
            {archetypeData.kind}
          </div>
          <div className="flex-1 min-h-0 pt-6 pb-12">
            <ArchetypeComponent />
          </div>
        </>
        : <>
          <div className="h-full pt-6 pb-12">
            <p>No archetype data</p>
            <Button onClick={() => setArchetypeData(sampleArchetypeData)}>Set archetype data</Button>
          </div>
        </>}

    </aside >
  );
}

