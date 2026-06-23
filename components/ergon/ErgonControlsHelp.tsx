"use client";

import type { ReactNode } from "react";

import { HelpCircle } from "lucide-react";

import { Button } from "@/components/third-party/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/third-party/ui/sheet";
import { cn } from "@/lib/utils";

type ControlRow = { keys: string[]; label: string };

const KEYBOARD_ROWS: ControlRow[] = [
  { keys: ["↑", "↓"], label: "Move between tasks" },
  { keys: ["Home", "End"], label: "First / last task" },
  { keys: ["Enter"], label: "Expand / collapse" },
  { keys: ["Space"], label: "Complete" },
  { keys: ["A"], label: "Toggle active" },
  { keys: ["E"], label: "Edit" },
  { keys: ["C"], label: "Chat about task" },
  { keys: ["Del"], label: "Delete (undoable)" },
  { keys: ["Esc"], label: "Collapse" },
  { keys: ["Ctrl", "Z"], label: "Undo" },
  { keys: ["Ctrl", "Y"], label: "Redo" },
];

const GESTURE_ROWS: ControlRow[] = [
  { keys: ["Tap"], label: "Expand / collapse" },
  { keys: ["Double tap"], label: "Chat about task" },
  { keys: ["Swipe →"], label: "Complete (short) · Active (long)" },
  { keys: ["Swipe ←"], label: "Delete (undoable)" },
];

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}

function Section({ title, rows }: { title: string; rows: ControlRow[] }) {
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">{title}</p>
      <ul className="space-y-1.5">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-foreground">{row.label}</span>
            <span className="flex shrink-0 items-center gap-1">
              {row.keys.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Help button that opens a sheet documenting Ergon's keyboard shortcuts and touch gestures. */
export function ErgonControlsHelp({ className }: { className?: string }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          aria-label="Controls and shortcuts"
          className={cn("size-8 shrink-0", className)}
          size="icon"
          type="button"
          variant="ghost"
        >
          <HelpCircle className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="max-h-[85dvh] gap-0 overflow-y-auto px-4 pb-6" side="bottom">
        <SheetHeader className="pb-4 text-left">
          <SheetTitle>Controls &amp; shortcuts</SheetTitle>
        </SheetHeader>
        <div className="mx-auto grid w-full max-w-2xl gap-6 sm:grid-cols-2">
          <Section rows={KEYBOARD_ROWS} title="Keyboard" />
          <Section rows={GESTURE_ROWS} title="Touch gestures" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
