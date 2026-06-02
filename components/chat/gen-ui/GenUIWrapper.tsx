"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { toast } from "sonner";

import { glass } from "@/components/design-system/primitives";
import type { GenUIBlock } from "@/lib/schemas/gen-ui";
import { copyTextToClipboard } from "@/lib/clipboard/copy";
import { cn } from "@/lib/utils";

import { GEN_UI_REGISTRY, getGenUIBlockTitle } from "./registry";

type GenUIWrapperProps = {
  block: GenUIBlock;
  children: ReactNode;
  partial?: boolean;
};

export function GenUIWrapper({ block, children, partial }: GenUIWrapperProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);
  const entry = GEN_UI_REGISTRY[block.type];
  const title = getGenUIBlockTitle(block);

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
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {entry.label}
            {partial ? " · partial" : null}
          </span>
          <p className="truncate text-sm font-medium text-foreground">{title}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
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
