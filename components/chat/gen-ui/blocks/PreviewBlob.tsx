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
  /** Compact thumbnail-forward card: image fills the card, title bar overlay, cost chip. */
  condensed?: boolean;
};

export function PreviewBlob({ block, onCommit, condensed = false }: PreviewBlobProps) {
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

  if (condensed) {
    return (
      <section className="w-full space-y-stack-xs">
        <a
          href={expandedSrc}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${block.title} preview in a new tab`}
          className={cn(
            "relative block aspect-video w-full overflow-hidden rounded-2xl bg-muted/40",
            FOCUS
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- remote preview URLs are model-supplied https */}
          <img
            src={block.previewURL}
            alt={`${block.title} preview`}
            loading="lazy"
            className="absolute inset-0 size-full object-cover"
          />
          {block.costEstimate ? (
            <span
              className="absolute top-inset-sm right-inset-sm rounded-full bg-background/80 px-inset-sm py-0.5 font-mono text-2xs tabular-nums text-foreground backdrop-blur-sm"
              aria-label={`Estimated cost ${block.costEstimate}`}
            >
              {block.costEstimate}
            </span>
          ) : null}
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent px-inset-sm pt-inset-md pb-inset-sm">
            <span className="block truncate text-sm font-medium text-foreground">{block.title}</span>
          </span>
        </a>

        {onCommit ? (
          <div className="flex items-center justify-between gap-inline-sm">
            <span role="status" className="text-2xs text-muted-foreground">
              {status === "committing" ? "Starting full render…" : null}
              {status === "done" ? "Full render requested." : null}
              {status === "error" ? "Couldn’t start the full render." : null}
            </span>
            {status === "ready" ? (
              <button
                type="button"
                onClick={() => void commit()}
                className={cn(
                  "rounded-lg bg-accent px-inset-sm py-1.5 text-xs font-medium text-accent-foreground",
                  FOCUS
                )}
              >
                Commit full render
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className={cn("w-full rounded-2xl bg-muted/30 p-inset-md", spacing.card.section)}>
      <div className="flex items-baseline justify-between gap-inline-md">
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
        <span className="block px-inset-md py-inset-sm text-xs text-muted-foreground">
          {expanded ? "Tap to collapse" : "Tap to expand preview"}
        </span>
      </button>

      {block.prompt ? (
        <p className="rounded-xl bg-muted/30 p-inset-md text-xs text-muted-foreground">
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
            "min-h-11 rounded-lg bg-accent px-inset-md text-sm font-medium text-accent-foreground",
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
