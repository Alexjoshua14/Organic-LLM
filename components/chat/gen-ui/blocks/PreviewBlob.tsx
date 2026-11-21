"use client";

import type { PreviewBlobBlock } from "@/lib/schemas/gen-ui";

import { useState } from "react";

import { spacing } from "@/lib/design-tokens/spacing";
import { cn } from "@/lib/utils";

const FOCUS =
  "organic-focus focus-visible:outline-none focus-visible:bg-foreground focus-visible:text-background";

type PreviewBlobProps = {
  block: PreviewBlobBlock;
  partial?: boolean;
  /** Host commits to a full-fidelity render (e.g. agent sandbox job). */
  onCommit?: () => void | Promise<void>;
};

export function PreviewBlob({ block, onCommit }: PreviewBlobProps) {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<"ready" | "committing" | "done" | "error">("ready");
  const expandedSrc = block.svgURL ?? block.previewURL;

  const commit = async () => {
    if (!onCommit || status === "committing") return;
    setStatus("committing");
    try {
      await onCommit();
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  return (
    <section className={cn("w-full rounded-2xl bg-muted/30 p-inset-md", spacing.card.section)}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-foreground">{block.title}</h3>
        {block.costEstimate ? (
          <span className="font-mono text-xs text-muted-foreground">{block.costEstimate}</span>
        ) : null}
      </div>

      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "block w-full overflow-hidden rounded-xl bg-muted/40 text-left",
          FOCUS
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- remote preview URLs are model-supplied https */}
        <img
          src={expanded ? expandedSrc : block.previewURL}
          alt={expanded ? `${block.title} expanded preview` : `${block.title} preview`}
          className={cn(
            "mx-auto max-h-48 w-auto object-contain",
            expanded && "max-h-96"
          )}
        />
        <span className="block px-3 py-2 text-xs text-muted-foreground">
          {expanded ? "Tap to collapse" : "Tap to expand preview"}
        </span>
      </button>

      {block.prompt ? (
        <p className="rounded-xl bg-muted/30 p-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Prompt · </span>
          {block.prompt}
        </p>
      ) : null}

      <div role="status" className="text-sm text-muted-foreground">
        {status === "committing" ? "Starting full render…" : null}
        {status === "done" ? "Full render requested." : null}
        {status === "error" ? "Couldn’t start the full render." : null}
        {status === "ready" && !onCommit
          ? "Preview only. Full-fidelity render is a host / sandbox concern."
          : null}
      </div>

      {onCommit && status === "ready" ? (
        <button
          type="button"
          onClick={() => void commit()}
          className={cn(
            "min-h-11 rounded-lg bg-accent px-3 text-sm font-medium text-accent-foreground",
            FOCUS
          )}
        >
          Commit full render
        </button>
      ) : null}

      {block.footnote ? <p className="text-xs text-muted-foreground">{block.footnote}</p> : null}
    </section>
  );
}
