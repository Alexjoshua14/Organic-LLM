"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { Save, X } from "lucide-react";

import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputTextarea,
  type PromptInputMessage,
  usePromptInputController,
} from "@/components/third-party/ai-elements/prompt-input";

import { cn } from "@/lib/utils";
import { sanitizeRawUserInput } from "@/lib/strata/input-safety";

export type StrataNotepadProps = {
  /** Pass `activeNoteId` so PromptInput resets when swapping notes without fighting live typing. */
  noteId: string;
  title: string;
  onTitleChange: (title: string) => void;
  body: string;
  onBodyChange: (markdown: string) => void;
  syncFooter: { busy: boolean; label: string };
  onFlushPersist: () => Promise<void>;
  onCloseNote?: () => void | Promise<void>;
  className?: string;
};

const TITLE_MAX_LENGTH = 512;

function StrataPromptNoteChrome({
  body,
  onBodyChange,
  syncFooter,
}: {
  body: string;
  onBodyChange: (markdown: string) => void;
  syncFooter: { busy: boolean; label: string };
}) {
  const { textInput } = usePromptInputController();

  useEffect(() => {
    if (textInput.value !== body) {
      textInput.setInput(body);
    }
  }, [body, textInput]);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      onBodyChange(sanitizeRawUserInput(e.currentTarget.value));
    },
    [onBodyChange]
  );

  const noopSubmit = useCallback((_message: PromptInputMessage, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  }, []);

  const wordCount = useMemo(() => {
    const t = body.trim();

    return t.length === 0 ? 0 : t.split(/\s+/u).length;
  }, [body]);

  return (
    <PromptInput
      multiple
      className={cn(
        "min-h-0 flex-1 flex-col rounded-xl [&_form]:min-h-[min(12rem,calc(100vh-14rem))]"
      )}
      onSubmit={noopSubmit}
    >
      <PromptInputBody className="flex flex-1 flex-col">
        <PromptInputTextarea
          submitOnEnter={false}
          className={cn(
            "text-lg! md:text-lg! placeholder:text-lg! caret-accent placeholder:text-foreground/80",
            "!max-h-none min-h-[min(12rem,calc(100vh-14rem))]",
            "!resize-y"
          )}
          enterKeyHint="enter"
          name="strata-note"
          placeholder="Write your note…"
          onChange={handleChange}
        />
      </PromptInputBody>

      <PromptInputFooter className="flex shrink-0 items-center justify-between border-t border-border/15 px-3 py-2">
        <span className="text-sm font-semibold tabular-nums text-muted-foreground">
          {wordCount.toLocaleString()} words
        </span>
        <span
          className={cn(
            "text-xs tabular-nums text-muted-foreground",
            syncFooter.busy ? "animate-pulse" : null
          )}
        >
          {syncFooter.label}
        </span>
      </PromptInputFooter>
    </PromptInput>
  );
}

/**
 * Plain-text Strata scratch surface using the homepage glass prompt chrome.
 * Layered persistence (local vs Supabase) is owned by the shell via `sections.raw_text`.
 */
export function StrataNotepad({
  noteId,
  title,
  onTitleChange,
  body,
  onBodyChange,
  syncFooter,
  onFlushPersist,
  onCloseNote,
  className,
}: StrataNotepadProps) {
  const [saving, setSaving] = useState(false);

  const handleSaveNow = useCallback(async () => {
    setSaving(true);
    try {
      await onFlushPersist();
    } finally {
      setSaving(false);
    }
  }, [onFlushPersist]);

  const handleCloseNote = useCallback(async () => {
    if (!onCloseNote) return;
    setSaving(true);
    try {
      await onFlushPersist();
      await Promise.resolve(onCloseNote());
    } finally {
      setSaving(false);
    }
  }, [onCloseNote, onFlushPersist]);

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col gap-2.5 overflow-hidden text-foreground",
        className
      )}
      data-strata-notepad
      data-note-id={noteId}
    >
      <div className="flex shrink-0 items-start gap-3">
        <input
          aria-label="Note title"
          className="min-w-0 flex-1 bg-transparent text-base font-semibold text-foreground outline-none placeholder:text-muted-foreground"
          maxLength={TITLE_MAX_LENGTH}
          placeholder="Untitled note"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
        />
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled={saving || syncFooter.busy}
            onClick={() => void handleSaveNow()}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-md border border-transparent px-2 py-1 text-xs font-medium text-muted-foreground transition-colors",
              "hover:border-border/40 hover:bg-muted/30 hover:text-foreground disabled:opacity-50"
            )}
            title="Save now"
            aria-label="Save now"
          >
            <Save className="size-3.5" aria-hidden />
            Save
          </button>
          {onCloseNote ? (
            <button
              type="button"
              disabled={saving || syncFooter.busy}
              onClick={() => void handleCloseNote()}
              className={cn(
                "inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors",
                "hover:border-border/40 hover:bg-muted/30 hover:text-foreground disabled:opacity-50"
              )}
              title="Close note — save to sources and clear"
              aria-label="Close note"
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col [&_form]:min-h-0 [&_form]:flex-1 [&_form]:flex-col [&_fieldset]:contents">
        <PromptInputProvider key={noteId} initialInput={body}>
          <StrataPromptNoteChrome body={body} syncFooter={syncFooter} onBodyChange={onBodyChange} />
        </PromptInputProvider>
      </div>
    </div>
  );
}

export default StrataNotepad;
