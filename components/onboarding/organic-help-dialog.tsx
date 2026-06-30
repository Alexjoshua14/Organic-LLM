"use client";

import type { KeyboardShortcutScope } from "@/lib/onboarding/keyboard-shortcuts";

import { HelpCircle, Keyboard, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { KeyboardShortcutKbd } from "./keyboard-shortcut-kbd";

import { glass, glassPreview } from "@/components/design-system/primitives";
import { Button } from "@/components/third-party/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/third-party/ui/dialog";
import { requestFeatureGuideResume } from "@/lib/onboarding/feature-hint-explicit-request";
import {
  KEYBOARD_SHORTCUT_SCOPES,
  KEYBOARD_SHORTCUT_SCOPE_LABELS,
  getKeyboardShortcutsByScope,
} from "@/lib/onboarding/keyboard-shortcuts";
import { cn } from "@/lib/utils";

type OrganicHelpDialogProps = {
  className?: string;
  /** Compact icon-only trigger for control cluster. */
  triggerClassName?: string;
};

function ShortcutSection({ scope }: { scope: KeyboardShortcutScope }) {
  const rows = getKeyboardShortcutsByScope(scope);

  if (rows.length === 0) return null;

  return (
    <section
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-border/50",
        glass({ opaque: true })
      )}
    >
      <div className="border-b border-border/40 px-3.5 py-2.5 sm:px-4">
        <h3 className="font-commissioner text-sm font-light tracking-wide text-foreground">
          {KEYBOARD_SHORTCUT_SCOPE_LABELS[scope]}
        </h3>
      </div>
      <ul className="divide-y divide-border/30 px-1.5 py-1 sm:px-2">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex items-start justify-between gap-3 rounded-lg px-2 py-2.5 sm:gap-4"
          >
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm text-foreground">{row.label}</p>
              {row.hint ? (
                <p className="text-[11px] leading-snug text-muted-foreground">{row.hint}</p>
              ) : null}
            </div>
            <span className="flex shrink-0 flex-wrap items-center justify-end gap-1">
              {row.keys.map((key) => (
                <KeyboardShortcutKbd key={key}>{key}</KeyboardShortcutKbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function OrganicHelpDialog({ className, triggerClassName }: OrganicHelpDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          aria-label="Help, tips, and keyboard shortcuts"
          className={cn("size-8 shrink-0", triggerClassName, className)}
          size="icon"
          type="button"
          variant="ghost"
        >
          <HelpCircle className="size-4" />
        </Button>
      </DialogTrigger>

      <DialogContent
        className={cn(
          "flex max-h-[min(90dvh,720px)] w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden border-0 bg-transparent p-0 shadow-none sm:max-w-2xl"
        )}
      >
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-hidden sm:rounded-lg",
            glassPreview({ opaque: true, depth: "floating" }),
            "shadow-[0_24px_80px_-24px_rgb(0_0_0/0.45)]"
          )}
        >
        <DialogHeader className="shrink-0 space-y-2 border-b border-border/40 px-4 py-4 text-left sm:space-y-3 sm:px-6 sm:py-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
            Organic LLM
          </p>
          <div className="space-y-1 pr-6">
            <DialogTitle className="font-commissioner text-xl font-light tracking-wide sm:text-2xl">
              Help &amp; shortcuts
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              Tips appear once per feature — dismiss with Got it or Escape. Keyboard shortcuts
              work on desktop; touch targets are sized for mobile.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain touch-manipulation [scrollbar-gutter:stable]">
          <div className="space-y-4 px-4 py-4 sm:px-6 sm:py-5">
            <section
              className={cn(
                "rounded-xl border border-border/50 p-4 sm:p-5",
                glassPreview({ interactive: true })
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/50",
                    "bg-muted/30 text-lumen"
                  )}
                >
                  <Sparkles className="size-4" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 space-y-2">
                  <h3 className="font-commissioner text-base font-light tracking-wide text-foreground">
                    First-time tips
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Contextual coachmarks highlight Search, Memory, Noesis sparks, and more. They
                    stay until you dismiss them and won&apos;t return on this browser once dismissed.
                    After four tips in a row, we pause so you can use the unobstructed UI — use
                    Show next tip when you&apos;re ready for more.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      className="h-8 text-xs"
                      size="sm"
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        requestFeatureGuideResume();
                        setOpen(false);
                      }}
                    >
                      Show next tip
                    </Button>
                    <Button asChild className="h-8 text-xs" size="sm" variant="secondary">
                      <Link href="/showcase/anatomy">Public demo</Link>
                    </Button>
                    <Button asChild className="h-8 text-xs" size="sm" variant="ghost">
                      <Link href="/dev/docs/feature-hints">Developer docs</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </section>

            <div className="flex items-center gap-2 text-muted-foreground">
              <Keyboard className="size-4 shrink-0 text-lumen" strokeWidth={1.75} />
              <p className="text-xs uppercase tracking-[0.14em]">Keyboard</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
              {KEYBOARD_SHORTCUT_SCOPES.map((scope) => (
                <ShortcutSection key={scope} scope={scope} />
              ))}
            </div>
          </div>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
