"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

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

const ITEM_CLASS =
  "w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-background-tertiary/60 pointer-coarse:min-h-11 pointer-coarse:text-sm";

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
  const [position, setPosition] = useState({ left: x, top: y });

  // Keep the menu on screen: a tap near the right or bottom edge of a phone would otherwise
  // open it half outside the viewport.
  useLayoutEffect(() => {
    const box = ref.current?.getBoundingClientRect();

    if (!box) return;
    const margin = 8;

    setPosition({
      left: Math.max(margin, Math.min(x, window.innerWidth - box.width - margin)),
      top: Math.max(margin, Math.min(y, window.innerHeight - box.height - margin)),
    });
  }, [x, y, label]);

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
      style={position}
    >
      <p className="truncate px-2 py-1 text-2xs font-medium text-muted-foreground">{label}</p>
      <button className={ITEM_CLASS} type="button" onClick={onExplain}>
        Explain this
      </button>
      <button className={ITEM_CLASS} type="button" onClick={onExpandBranch}>
        Expand this branch
      </button>
      <button className={ITEM_CLASS} type="button" onClick={onRabbitHole}>
        Open rabbit hole
      </button>
      <button className={ITEM_CLASS} type="button" onClick={onChatAbout}>
        Chat about this
      </button>
    </div>
  );
}
