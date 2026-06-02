"use client";

import { useCallback, useEffect } from "react";

import { Button } from "@/components/third-party/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/third-party/ui/dialog";

type T3CodeStubModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  craftedPrompt: string;
};

export function T3CodeStubModal({ open, onOpenChange, craftedPrompt }: T3CodeStubModalProps) {
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(craftedPrompt);
    } catch {
      /* ignore */
    }
  }, [craftedPrompt]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "c" || e.metaKey || e.altKey || e.ctrlKey) {
        return;
      }
      const target = e.target as HTMLElement | null;

      if (target?.closest?.("[data-t3code-stub-dialog]")) {
        e.preventDefault();
        void copy();
      }
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [open, copy]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-t3code-stub-dialog>
        <DialogHeader>
          <DialogTitle>T3 code lookup</DialogTitle>
          <DialogDescription className="text-left space-y-2">
            This path is not implemented yet. Your message included the token <code>t3code</code>,
            which would route to an internal knowledge check once wired up. Below is the crafted
            prompt you can copy manually.
          </DialogDescription>
        </DialogHeader>
        <pre className="max-h-48 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
          {craftedPrompt}
        </pre>
        <DialogFooter className="flex-col gap-2 sm:flex-col sm:items-stretch">
          <Button type="button" onClick={() => void copy()}>
            Copy to clipboard
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Press C while this dialog is focused to copy.
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
