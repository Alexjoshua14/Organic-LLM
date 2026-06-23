"use client";

import type { ReactNode } from "react";

import { HelpCircle, Keyboard, Smartphone } from "lucide-react";
import { useState } from "react";

import { glass } from "@/components/design-system/primitives";
import { Button } from "@/components/third-party/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/third-party/ui/dialog";
import { cn } from "@/lib/utils";

type ControlRow = { keys: string[]; label: string; hint?: string };

const KEYBOARD_ROWS: ControlRow[] = [
  { keys: ["↑", "↓"], label: "Move between tasks" },
  { keys: ["Home", "End"], label: "First / last task" },
  { keys: ["Enter"], label: "Expand / collapse" },
  { keys: ["Space"], label: "Mark complete" },
  { keys: ["A"], label: "Toggle active" },
  { keys: ["E"], label: "Edit task" },
  { keys: ["C"], label: "Chat about task" },
  { keys: ["Del"], label: "Delete", hint: "Undo with Ctrl+Z" },
  { keys: ["Esc"], label: "Collapse row" },
  { keys: ["Ctrl", "Z"], label: "Undo" },
  { keys: ["Ctrl", "Y"], label: "Redo" },
];

const GESTURE_ROWS: ControlRow[] = [
  { keys: ["Tap"], label: "Expand / collapse" },
  { keys: ["Double tap"], label: "Chat about task" },
  { keys: ["Swipe →"], label: "Complete or mark active", hint: "Short = complete · long = active" },
  { keys: ["Swipe ←"], label: "Delete", hint: "Undoable" },
];

function Kbd({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <kbd
      className={cn(
        "inline-flex min-h-6 items-center justify-center rounded-md border border-border/60",
        "bg-background/80 px-2 py-0.5 font-mono text-[10px] font-medium leading-none text-foreground/90",
        "shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_1px_2px_rgb(0_0_0/0.06)]",
        "dark:bg-background/40 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]",
        wide && "min-w-[4.5rem] px-2.5"
      )}
    >
      {children}
    </kbd>
  );
}

function ControlPanel({
  icon: Icon,
  title,
  subtitle,
  rows,
}: {
  icon: typeof Keyboard;
  title: string;
  subtitle: string;
  rows: ControlRow[];
}) {
  return (
    <section
      className={cn(
        "flex flex-col rounded-xl border border-border/50",
        glass({ opaque: true })
      )}
    >
      <div className="shrink-0 border-b border-border/40 px-3.5 py-2.5 sm:px-4 sm:py-3">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/50",
              "bg-muted/40 text-lumen"
            )}
          >
            <Icon className="size-4" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 space-y-0.5">
            <h3 className="font-commissioner text-sm font-light tracking-wide text-foreground">
              {title}
            </h3>
            <p className="text-xs leading-snug text-muted-foreground">{subtitle}</p>
          </div>
        </div>
      </div>

      <ul className="divide-y divide-border/30 px-1.5 py-1 sm:px-2 sm:py-1.5">
        {rows.map((row) => (
          <li
            key={row.label}
            className="flex items-start justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/20 sm:gap-4 sm:py-2.5"
          >
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm text-foreground">{row.label}</p>
              {row.hint ? <p className="text-[11px] leading-snug text-muted-foreground">{row.hint}</p> : null}
            </div>
            <span className="flex shrink-0 flex-wrap items-center justify-end gap-1">
              {row.keys.map((key) => (
                <Kbd key={key} wide={key.includes("Swipe") || key === "Double tap"}>
                  {key}
                </Kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Help button that opens a modal documenting Ergon keyboard shortcuts and touch gestures. */
export function ErgonControlsHelp({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          aria-label="Controls and shortcuts"
          className={cn("size-8 shrink-0", className)}
          size="icon"
          type="button"
          variant="ghost"
        >
          <HelpCircle className="size-4" />
        </Button>
      </DialogTrigger>

      <DialogContent
        overlayClassName="bg-background/70 backdrop-blur-sm"
        className={cn(
          "flex min-h-0 max-h-[min(85dvh,640px)] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden border-border/60 p-0 sm:max-w-2xl",
          glass({ opaque: true }),
          "shadow-[0_24px_80px_-24px_rgb(0_0_0/0.45)]"
        )}
      >
        <DialogHeader className="shrink-0 space-y-2 border-b border-border/40 px-5 py-4 text-left sm:space-y-3 sm:px-6 sm:py-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">Ergon</p>
          <div className="space-y-1 pr-6">
            <DialogTitle className="font-commissioner text-xl font-light tracking-wide sm:text-2xl">
              Controls &amp; shortcuts
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              Navigate tasks from the keyboard on desktop, or use touch gestures on mobile.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain touch-manipulation [scrollbar-gutter:stable]">
          <div className="grid gap-3 px-4 py-3 sm:grid-cols-2 sm:gap-4 sm:px-6 sm:py-4 sm:pb-5">
            <ControlPanel
              icon={Keyboard}
              rows={KEYBOARD_ROWS}
              subtitle="Focus a task row, then use these keys."
              title="Keyboard"
            />
            <ControlPanel
              icon={Smartphone}
              rows={GESTURE_ROWS}
              subtitle="Works on touch devices in the task list."
              title="Touch"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
