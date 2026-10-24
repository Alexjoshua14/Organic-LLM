"use client";

import type { FiledMemory } from "../_lib/memory-ingest-filed";

import { MemoryFiledRow } from "./MemoryFiledRow";

import { cn } from "@/lib/utils";

export type MemoryIngestSessionTrayProps = {
  sessionFiled: FiledMemory[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expandedTs: number | null;
  onToggleExpand: (ts: number) => void;
  onForget: (id: string) => Promise<boolean>;
};

function sessionTrayLabel(count: number): string {
  return count === 1 ? "1 memory filed recently" : `${count} memories filed recently`;
}

/**
 * Compact pill + scrollable list of filings in the current resume-window session.
 */
export function MemoryIngestSessionTray({
  sessionFiled,
  open,
  onOpenChange,
  expandedTs,
  onToggleExpand,
  onForget,
}: MemoryIngestSessionTrayProps) {
  if (sessionFiled.length === 0) return null;

  return (
    <div className="mx-auto mb-2 w-full max-w-[min(100%,360px)]">
      <button
        aria-expanded={open}
        className={cn(
          "w-full cursor-pointer rounded-full border border-border/80 bg-card/70 px-3 py-1.5",
          "text-center text-2xs text-muted-foreground backdrop-blur-sm transition-colors",
          "hover:text-foreground hover:border-border focus-visible:outline-none focus-visible:ring-1",
          "focus-visible:ring-ring"
        )}
        type="button"
        onClick={() => onOpenChange(!open)}
      >
        {sessionTrayLabel(sessionFiled.length)}
      </button>

      {open ? (
        <ul
          aria-label="Recently filed memories"
          className="mt-2 flex max-h-[min(40vh,280px)] flex-col gap-1.5 overflow-y-auto overscroll-y-contain"
        >
          {sessionFiled.map((m) => (
            <li key={m.id ?? m.ts}>
              <MemoryFiledRow
                expanded={expandedTs === m.ts}
                filed={m}
                showUndo
                variant="list"
                onForget={onForget}
                onToggleExpand={() => onToggleExpand(m.ts)}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
