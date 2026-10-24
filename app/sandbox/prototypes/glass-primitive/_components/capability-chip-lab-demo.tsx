"use client";

import { useState } from "react";
import { BrainCircuit, Eye, GlobeIcon, Volume2, type LucideIcon } from "lucide-react";

import { type ComposerChipId, ComposerToolChip } from "@/components/chat/composer-tool-chip";
import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

const CAPABILITY_CHIPS: { id: ComposerChipId; label: string; icon: LucideIcon }[] = [
  { id: "search", label: "Search", icon: GlobeIcon },
  { id: "memory", label: "Memory", icon: BrainCircuit },
  { id: "speech", label: "Speech", icon: Volume2 },
  { id: "preview", label: "Preview", icon: Eye },
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
      {CAPABILITY_CHIPS.map(({ id, label, icon: Icon }) => (
        <ComposerToolChip
          key={id}
          active={active[id] ?? false}
          chip={id}
          onClick={() => setActive((prev) => ({ ...prev, [id]: !prev[id] }))}
        >
          <Icon className="size-4" />
          <span className="text-xs">{label}</span>
        </ComposerToolChip>
      ))}
    </div>
  );
}
