"use client";

import { useCallback, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { StrataTextSourceCard } from "./StrataTextSourceCard";

import { glass } from "@/components/design-system/primitives";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/third-party/ui/dialog";
import { cn } from "@/lib/utils";
import { STRATA_TEXT_SOURCE_BODY_MAX, type StrataTextSourceNode } from "@/lib/schemas/strata";
import { sanitizeRawUserInput } from "@/lib/strata/input-safety";
import { getStrataTextSourceTypeLabel } from "@/lib/strata/text-sources";

export function StrataTextSourcesList({
  sources,
  activeNoteId,
  onRemove,
  onMove,
  onUpdateSource,
  onActivateUserText,
}: {
  sources: StrataTextSourceNode[];
  /** The note currently loaded in the notepad — rendered with an "Editing" pill when set. */
  activeNoteId?: string | null;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onUpdateSource: (id: string, patch: { title: string; body: string }) => void;
  /** Click handler for `kind === "user_text"` cards; replaces the read-modal flow for notes. */
  onActivateUserText?: (id: string) => void;
}) {
  const [readSourceId, setReadSourceId] = useState<string | null>(null);
  const [editSourceId, setEditSourceId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");

  const readSource = useMemo(
    () => (readSourceId ? (sources.find((s) => s.id === readSourceId) ?? null) : null),
    [readSourceId, sources]
  );

  const editSource = useMemo(
    () => (editSourceId ? (sources.find((s) => s.id === editSourceId) ?? null) : null),
    [editSourceId, sources]
  );

  const openEdit = useCallback(
    (id: string) => {
      const s = sources.find((x) => x.id === id);

      if (!s) return;
      setReadSourceId(null);
      setEditSourceId(id);
      setEditTitle(s.title);
      setEditBody(s.body);
    },
    [sources]
  );

  const commitEdit = useCallback(() => {
    if (!editSource) return;
    const title = sanitizeRawUserInput(editTitle.trim() || "Untitled").slice(0, 512);
    const body = sanitizeRawUserInput(editBody);

    if (body.length > STRATA_TEXT_SOURCE_BODY_MAX) {
      toast.error("Body is too long", {
        description: `Maximum ${STRATA_TEXT_SOURCE_BODY_MAX.toLocaleString()} characters.`,
      });

      return;
    }
    onUpdateSource(editSource.id, { title, body });
    setEditSourceId(null);
  }, [editBody, editSource, editTitle, onUpdateSource]);

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
      <ul className="grid grid-cols-1 gap-2 pr-1">
        {sources.map((s, index) => {
          const isActive = activeNoteId != null && s.id === activeNoteId;
          const handleOpen =
            s.kind === "user_text" && onActivateUserText
              ? () => onActivateUserText(s.id)
              : () => {
                  setEditSourceId(null);
                  setReadSourceId(s.id);
                };

          return (
            <li key={s.id}>
              <StrataTextSourceCard
                active={isActive}
                index={index}
                source={s}
                total={sources.length}
                onEdit={openEdit}
                onMove={onMove}
                onOpen={handleOpen}
                onRemove={onRemove}
              />
            </li>
          );
        })}
      </ul>

      <Dialog open={readSource !== null} onOpenChange={(open) => !open && setReadSourceId(null)}>
        <DialogContent className="max-h-[min(90vh,50rem)] max-w-2xl overflow-hidden p-0">
          {readSource ? (
            <>
              <DialogHeader className="border-b border-border/60 px-6 py-4 text-left">
                <DialogTitle className="pr-8">{readSource.title}</DialogTitle>
                <DialogDescription>
                  {getStrataTextSourceTypeLabel(readSource.kind)} ·{" "}
                  {new Date(readSource.createdAt).toLocaleString()}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 overflow-y-auto px-6 py-5">
                {readSource.meta ? (
                  <div className="rounded-md border border-border/50 bg-muted/10 p-3 text-xs text-muted-foreground">
                    <p className="mb-2 font-medium uppercase tracking-wide text-foreground">
                      Metadata
                    </p>
                    <ul className="space-y-1">
                      {readSource.meta.filename ? (
                        <li>
                          <span className="font-medium text-foreground">File:</span>{" "}
                          {readSource.meta.filename}
                        </li>
                      ) : null}
                      {readSource.meta.query ? (
                        <li>
                          <span className="font-medium text-foreground">Query:</span>{" "}
                          {readSource.meta.query}
                        </li>
                      ) : null}
                      {readSource.meta.url ? (
                        <li className="flex items-center gap-1">
                          <span className="font-medium text-foreground">URL:</span>
                          <a
                            href={readSource.meta.url}
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
                  {readSource.body}
                </article>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={editSource !== null}
        onOpenChange={(open) => {
          if (!open) setEditSourceId(null);
        }}
      >
        <DialogContent className="max-h-[min(90dvh,44rem)] max-w-2xl gap-0 overflow-hidden p-0 sm:max-w-2xl">
          {editSource ? (
            <>
              <DialogHeader className="border-b border-border/60 px-6 py-4 text-left">
                <DialogTitle>Edit source</DialogTitle>
                <DialogDescription>
                  {getStrataTextSourceTypeLabel(editSource.kind)} · changes apply to this page only.
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[min(60dvh,28rem)] space-y-3 overflow-y-auto px-6 py-4">
                <input
                  className={cn(
                    glass(),
                    "w-full rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                  )}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
                <textarea
                  className={cn(
                    glass(),
                    "min-h-[12rem] w-full resize-y rounded-md border border-border/60 bg-background/40 p-3 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                  )}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {editBody.length.toLocaleString()} /{" "}
                  {STRATA_TEXT_SOURCE_BODY_MAX.toLocaleString()} characters
                </p>
              </div>
              <DialogFooter className="border-t border-border/60 px-6 py-4 sm:justify-end">
                <button
                  type="button"
                  className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  onClick={() => setEditSourceId(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={cn(
                    glass({ opaque: true }),
                    "rounded-md border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  )}
                  onClick={() => void commitEdit()}
                >
                  Save
                </button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
