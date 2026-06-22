"use client";

import { useState } from "react";
import { BrainCircuit, Eye, GlobeIcon, Volume2 } from "lucide-react";

import { ComposerToolChip } from "@/components/chat/composer-tool-chip";
import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

const CAPABILITY_TOOLS = [
  { id: "search" as const, label: "Search", icon: GlobeIcon },
  { id: "memory" as const, label: "Memory", icon: BrainCircuit },
  { id: "speech" as const, label: "Speech", icon: Volume2 },
  { id: "preview" as const, label: "Preview", icon: Eye },
];

export function CapabilityChipLabDemo() {
  const [active, setActive] = useState<Record<string, boolean>>({
    search: true,
    memory: false,
    speech: false,
    preview: false,
  });

  return (
    <div
      className={cn(
        glass({ opaque: true }),
        "flex flex-wrap items-center gap-1 overflow-hidden rounded-xl px-2 py-2"
      )}
    >
      {CAPABILITY_TOOLS.map(({ id, label, icon: Icon }) => (
        <ComposerToolChip
          key={id}
          active={active[id] ?? false}
          tool={id}
          onClick={() => setActive((prev) => ({ ...prev, [id]: !prev[id] }))}
        >
          <Icon className="size-4" />
          <span className="text-xs">{label}</span>
        </ComposerToolChip>
      ))}
    </div>
  );
}
