"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, Trash2 } from "lucide-react";

import { glass } from "@/components/design-system/primitives";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/third-party/ui/dialog";
import { cn } from "@/lib/utils";
import type { StrataTextSourceNode } from "@/lib/schemas/strata";

function formatKind(kind: StrataTextSourceNode["kind"]): string {
  switch (kind) {
    case "user_text":
      return "User text";
    case "clipboard":
      return "Clipboard";
    case "file":
      return "File";
    case "web_query":
      return "Web search";
    case "url":
      return "Imported URL";
    default:
      return kind;
  }
}

export function StrataTextSourcesList({
  sources,
  onRemove,
  onMove,
}: {
  sources: StrataTextSourceNode[];
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
}) {
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

  const selectedSource = useMemo(
    () => (selectedSourceId ? sources.find((s) => s.id === selectedSourceId) ?? null : null),
    [selectedSourceId, sources]
  );

  const selectedIndex = useMemo(
    () => (selectedSource ? sources.findIndex((s) => s.id === selectedSource.id) : -1),
    [selectedSource, sources]
  );

  if (sources.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border/60 bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground">
        No structured sources yet. Add text, paste, import a file, search the web, or import a URL
        below.
      </p>
    );
  }

  return (
    <>
      <ul className="grid grid-cols-1 gap-2 pr-1 sm:grid-cols-2">
        {sources.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              className={cn(
                glass({ opaque: true }),
                "group w-full rounded-lg border border-border/60 px-4 py-3 text-left transition-colors hover:bg-muted/25"
              )}
              onClick={() => setSelectedSourceId(s.id)}
            >
              <span className="block truncate text-sm font-medium text-foreground">{s.title}</span>
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={selectedSource !== null} onOpenChange={(open) => !open && setSelectedSourceId(null)}>
        <DialogContent className="max-h-[min(90vh,50rem)] max-w-2xl overflow-hidden p-0">
          {selectedSource ? (
            <>
              <DialogHeader className="border-b border-border/60 px-6 py-4 text-left">
                <DialogTitle className="pr-8">{selectedSource.title}</DialogTitle>
                <DialogDescription>
                  {formatKind(selectedSource.kind)} ·{" "}
                  {new Date(selectedSource.createdAt).toLocaleString()}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 overflow-y-auto px-6 py-5">
                {selectedSource.meta ? (
                  <div className="rounded-md border border-border/50 bg-muted/10 p-3 text-xs text-muted-foreground">
                    <p className="mb-2 font-medium uppercase tracking-wide text-foreground">Metadata</p>
                    <ul className="space-y-1">
                      {selectedSource.meta.filename ? (
                        <li>
                          <span className="font-medium text-foreground">File:</span>{" "}
                          {selectedSource.meta.filename}
                        </li>
                      ) : null}
                      {selectedSource.meta.query ? (
                        <li>
                          <span className="font-medium text-foreground">Query:</span>{" "}
                          {selectedSource.meta.query}
                        </li>
                      ) : null}
                      {selectedSource.meta.url ? (
                        <li className="flex items-center gap-1">
                          <span className="font-medium text-foreground">URL:</span>
                          <a
                            href={selectedSource.meta.url}
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                            rel="noreferrer"
                            target="_blank"
                          >
                            Open source <ExternalLink className="size-3" />
                          </a>
                        </li>
                      ) : null}
                    </ul>
                  </div>
                ) : null}

                <article className="whitespace-pre-wrap rounded-md border border-border/50 bg-background/40 p-4 text-sm leading-relaxed text-foreground">
                  {selectedSource.body}
                </article>

                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/50 pt-3">
                  <button
                    type="button"
                    className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                    disabled={selectedIndex <= 0}
                    title="Move up"
                    onClick={() => selectedSource && onMove(selectedSource.id, -1)}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                    disabled={selectedIndex < 0 || selectedIndex >= sources.length - 1}
                    title="Move down"
                    onClick={() => selectedSource && onMove(selectedSource.id, 1)}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="rounded-md p-2 text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
                    title="Remove source"
                    onClick={() => {
                      onRemove(selectedSource.id);
                      setSelectedSourceId(null);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
