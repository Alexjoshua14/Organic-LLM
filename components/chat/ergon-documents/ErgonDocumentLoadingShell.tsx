"use client";

import { FileText } from "lucide-react";

export function ErgonDocumentLoadingShell({ title }: { title?: string }) {
  return (
    <div className="not-prose overflow-hidden rounded-lg border border-border/50 bg-background-tertiary/30">
      <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
        <FileText className="size-3.5 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">{title ?? "Document"}</span>
      </div>
      <div className="space-y-2 px-3 py-4">
        <div className="h-3 w-2/3 animate-pulse rounded bg-background-tertiary/80" />
        <div className="h-3 w-full animate-pulse rounded bg-background-tertiary/60" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-background-tertiary/60" />
      </div>
    </div>
  );
}
