"use client";

import type { NoesisSpark } from "@/lib/sandbox/noesis/sparks/types";

import { useEffect, useState } from "react";
import { Play } from "lucide-react";

import { SparkDemoOverlay } from "./spark-demo-overlay";

import { Button } from "@/components/third-party/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/third-party/ui/dialog";

/**
 * Admin editor for an authored spark: tweak the system prompt + kickoff, then run a
 * demo. Edits here are in-memory only (for trialling) — persist by editing
 * `lib/sandbox/noesis/sparks/registry.ts` + `docs/noesis-sparks.md`.
 */
export function SparkEditorDialog({
  spark,
  open,
  onOpenChange,
}: {
  spark: NoesisSpark | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [systemPrompt, setSystemPrompt] = useState("");
  const [kickoff, setKickoff] = useState("");
  const [demoOpen, setDemoOpen] = useState(false);

  useEffect(() => {
    if (spark) {
      setSystemPrompt(spark.systemPrompt);
      setKickoff(spark.demoKickoff);
    }
  }, [spark]);

  if (!spark) return null;

  const canDemo = systemPrompt.trim().length > 0 && kickoff.trim().length > 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit spark — {spark.userFacingText}</DialogTitle>
            <DialogDescription>
              Tweak the system prompt and kickoff, then run a demo. Edits here are for trialling
              only; persist changes in{" "}
              <code className="text-[11px]">lib/sandbox/noesis/sparks/registry.ts</code>.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                htmlFor="noesis-spark-system-prompt"
              >
                System prompt
              </label>
              <textarea
                className="min-h-48 w-full resize-y rounded-lg border border-border/60 bg-background-secondary/40 px-3 py-2 font-mono text-[13px] leading-relaxed text-foreground focus:border-accent/50 focus:outline-none"
                id="noesis-spark-system-prompt"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                htmlFor="noesis-spark-kickoff"
              >
                Demo kickoff message
              </label>
              <textarea
                className="min-h-16 w-full resize-y rounded-lg border border-border/60 bg-background-secondary/40 px-3 py-2 text-[13px] leading-relaxed text-foreground focus:border-accent/50 focus:outline-none"
                id="noesis-spark-kickoff"
                value={kickoff}
                onChange={(e) => setKickoff(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              className="gap-1.5"
              disabled={!canDemo}
              type="button"
              onClick={() => setDemoOpen(true)}
            >
              <Play className="size-4" />
              Demo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SparkDemoOverlay
        kickoff={kickoff}
        open={demoOpen}
        spark={spark}
        systemPrompt={systemPrompt}
        onOpenChange={setDemoOpen}
      />
    </>
  );
}
