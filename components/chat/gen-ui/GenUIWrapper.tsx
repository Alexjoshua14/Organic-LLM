"use client";

import type { GenUIBlock } from "@/lib/schemas/gen-ui";

import { useCallback, useState, type ReactNode } from "react";
import { Bookmark, Check, ChevronDown, ChevronUp, Copy } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { GEN_UI_REGISTRY, getGenUIBlockTitle } from "./registry";

import { glass } from "@/components/design-system/primitives";
import { copyTextToClipboard } from "@/lib/clipboard/copy";
import { isSpatialArtifactsEnabled } from "@/lib/spatial-artifacts/coalescence-gate";
import { spatialArtifactId } from "@/lib/spatial-artifacts/artifact-id";
import { pinArtifactLocal } from "@/lib/spatial-artifacts/pin-store";
import { cn } from "@/lib/utils";

export type GenUIArtifactSource = {
  threadId: string;
  messageId: string;
  toolCallId: string;
  threadTitle?: string;
};

type GenUIWrapperProps = {
  block: GenUIBlock;
  children: ReactNode;
  partial?: boolean;
  artifactSource?: GenUIArtifactSource;
};

export function GenUIWrapper({ block, children, partial, artifactSource }: GenUIWrapperProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pinned, setPinned] = useState(false);
  const entry = GEN_UI_REGISTRY[block.type];
  const title = getGenUIBlockTitle(block);
  const showPin = isSpatialArtifactsEnabled() && artifactSource != null;

  const handleCopy = useCallback(async () => {
    const md = entry.toMarkdown(block);
    const ok = await copyTextToClipboard(md);

    if (!ok) {
      toast.error("Failed to copy");

      return;
    }
    setCopied(true);
    toast.success("Copied as markdown");
    setTimeout(() => setCopied(false), 2000);
  }, [block, entry]);

  const handlePin = useCallback(async () => {
    if (!artifactSource) return;

    setPinned(true);

    try {
      await pinArtifactLocal(
        spatialArtifactId({
          threadId: artifactSource.threadId,
          messageId: artifactSource.messageId,
          toolCallId: artifactSource.toolCallId,
          partIndex: 0,
        })
      );
      const { actionPinSpatialArtifact } = await import("@/app/actions/spatial-artifacts");
      const result = await actionPinSpatialArtifact({
        coalescenceMode: true,
        threadId: artifactSource.threadId,
        messageId: artifactSource.messageId,
        toolCallId: artifactSource.toolCallId,
        block,
        threadTitle: artifactSource.threadTitle,
      });

      if (!result.ok) {
        toast.error(result.error ?? "Failed to pin");

        return;
      }

      toast.success(
        <span>
          Pinned to spatial library.{" "}
          <Link className="underline" href="/sandbox/prototypes/spatial-archetypes">
            Open library
          </Link>
        </span>
      );
    } catch {
      toast.error("Failed to pin artifact");
      setPinned(false);
    }
  }, [artifactSource, block]);

  return (
    <div
      className={cn(
        glass({ opaque: true }),
        "not-prose rounded-lg border border-border/50 overflow-hidden",
        partial && "opacity-95"
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/40 px-3 py-2">
        <div className="min-w-0 flex-1">
          <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            {entry.label}
            {partial ? " · partial" : null}
          </span>
          <p className="truncate text-sm font-medium text-foreground">{title}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {showPin ? (
            <button
              type="button"
              aria-label="Pin to spatial library"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-background-tertiary/60 hover:text-foreground"
              disabled={pinned}
              onClick={() => void handlePin()}
            >
              {pinned ? <Check className="size-4" /> : <Bookmark className="size-4" />}
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Copy block as markdown"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-background-tertiary/60 hover:text-foreground"
            onClick={() => void handleCopy()}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </button>
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand block" : "Collapse block"}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-background-tertiary/60 hover:text-foreground"
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
          </button>
        </div>
      </div>
      {!collapsed ? <div className="px-3 py-3">{children}</div> : null}
    </div>
  );
}
