"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

type MermaidNodePopoverProps = {
  x: number;
  y: number;
  label: string;
  onExplain: () => void;
  onExpandBranch: () => void;
  onRabbitHole: () => void;
  onChatAbout: () => void;
  onClose: () => void;
};

export function MermaidNodePopover({
  x,
  y,
  label,
  onExplain,
  onExpandBranch,
  onRabbitHole,
  onChatAbout,
  onClose,
}: MermaidNodePopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };

    document.addEventListener("pointerdown", onPointer);

    return () => document.removeEventListener("pointerdown", onPointer);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={cn(
        "fixed z-[80] min-w-[11rem] rounded-lg border border-border/60",
        "bg-background/95 p-1 shadow-lg backdrop-blur-md"
      )}
      role="menu"
      style={{ left: x, top: y }}
    >
      <p className="truncate px-2 py-1 text-[10px] font-medium text-muted-foreground">{label}</p>
      <button
        className="w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-background-tertiary/60"
        type="button"
        onClick={onExplain}
      >
        Explain this
      </button>
      <button
        className="w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-background-tertiary/60"
        type="button"
        onClick={onExpandBranch}
      >
        Expand this branch
      </button>
      <button
        className="w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-background-tertiary/60"
        type="button"
        onClick={onRabbitHole}
      >
        Open rabbit hole
      </button>
      <button
        className="w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-background-tertiary/60"
        type="button"
        onClick={onChatAbout}
      >
        Chat about this
      </button>
    </div>
  );
}
