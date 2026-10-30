"use client";

import type { StageState } from "@/lib/stage/schema";

import { ChevronDown } from "lucide-react";
import { Popover } from "radix-ui";

/** Navigation controls live with the response controls, outside the owned artifact cells. */
export function StagePiecePicker({
  pieces,
  selectedId,
  onSelect,
}: {
  pieces: StageState["widgets"];
  selectedId?: string | null;
  onSelect: (id: string) => void;
}) {
  const selected = pieces.find((piece) => piece.id === selectedId);

  return (
    <Popover.Root>
      <Popover.Trigger
        className="stage-icon-button stage-piece-picker-trigger"
        aria-label="Choose a stage piece"
        title="Choose a piece"
      >
        {selected && <span>{selected.title}</span>}
        <ChevronDown aria-hidden size={12} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="stage-piece-picker"
          aria-label="Stage pieces"
          align="start"
          side="top"
          sideOffset={8}
        >
          {pieces.map((piece) => (
            <Popover.Close key={piece.id} asChild>
              <button
                type="button"
                aria-pressed={piece.id === selectedId}
                title={piece.source ? `${piece.title} · ${piece.source.name}` : piece.title}
                onClick={() => onSelect(piece.id)}
              >
                {piece.title}
              </button>
            </Popover.Close>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
