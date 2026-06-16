"use client";

import { Check, Copy, Download, ExternalLink } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { OpenInChat } from "@/components/design-system/OpenInChat";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/third-party/ui/dialog";
import {
  buildChatGptPrompt,
  buildCursorInstruction,
  getOpenInChatProviders,
  presetHasClipboardCursor,
  type ExportFormat,
  type ExportIntentPreset,
} from "@/lib/export/prompts";
import { readLastOpenInProvider } from "@/lib/export/last-provider-storage";
import { copyTextToClipboard } from "@/lib/clipboard/copy";
import { cn } from "@/lib/utils";

export function TextCopyModal({
  open,
  onOpenChange,
  title,
  description,
  text,
  copyLabel = "Copy",
  exportLabel = "Export",
  onExport,
  formatHint,
  externalIntent,
  externalButtonLabel,
  externalUserContext,
  generateExternalPrompt,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  text: string;
  copyLabel?: string;
  exportLabel?: string;
  onExport: (text: string) => void | Promise<void>;
  formatHint?: string;
  externalIntent?: ExportIntentPreset;
  externalButtonLabel?: string;
  externalUserContext?: string;
  generateExternalPrompt?: (args: {
    intent: ExportIntentPreset;
    sourceText: string;
    userContext?: string;
    exportFormat: ExportFormat;
    provider?: string | null;
  }) => Promise<string>;
}) {
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [preparedOpenInPrompt, setPreparedOpenInPrompt] = useState<string | null>(null);
  const [prepareFeedback, setPrepareFeedback] = useState(false);
  const [cursorFeedback, setCursorFeedback] = useState(false);
  const [preparingOpenIn, setPreparingOpenIn] = useState(false);
  const [copyingCursor, setCopyingCursor] = useState(false);

  const openInProviders = useMemo(
    () => (externalIntent ? getOpenInChatProviders(externalIntent) : []),
    [externalIntent]
  );
  const hasOpenIn = openInProviders.length > 0;
  const hasCursorClipboard = Boolean(externalIntent && presetHasClipboardCursor(externalIntent));

  const externalValidation = useMemo(() => {
    if (!externalIntent?.validate) return { ok: true as const };

    return externalIntent.validate(text);
  }, [externalIntent, text]);

  const validationBlocksExternal = externalValidation.ok === false;

  useEffect(() => {
    setPreparedOpenInPrompt(null);
    setPrepareFeedback(false);
    setCursorFeedback(false);
  }, [text, externalIntent?.id, open]);

  const handleCopy = useCallback(async () => {
    const ok = await copyTextToClipboard(text);

    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }
  }, [text]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      await onExport(text);
    } finally {
      setExporting(false);
    }
  }, [onExport, text]);

  const handlePrepareOpenIn = useCallback(async () => {
    if (!externalIntent || validationBlocksExternal) return;
    setPreparingOpenIn(true);
    try {
      const refinedPrompt = generateExternalPrompt
        ? await generateExternalPrompt({
            intent: externalIntent,
            sourceText: text,
            userContext: externalUserContext,
            exportFormat: "open_in_chat",
            provider: readLastOpenInProvider(externalIntent.id) ?? null,
          })
        : buildChatGptPrompt({
            preset: externalIntent,
            sourceText: text,
            userContext: externalUserContext,
          });

      await copyTextToClipboard(refinedPrompt);
      setPreparedOpenInPrompt(refinedPrompt);
      setPrepareFeedback(true);
      setTimeout(() => setPrepareFeedback(false), 1800);
    } catch {
      setPreparedOpenInPrompt(null);
    } finally {
      setPreparingOpenIn(false);
    }
  }, [externalIntent, externalUserContext, generateExternalPrompt, text, validationBlocksExternal]);

  const handleCopyCursorInstruction = useCallback(async () => {
    if (!externalIntent || validationBlocksExternal) return;
    setCopyingCursor(true);
    try {
      const instruction = generateExternalPrompt
        ? await generateExternalPrompt({
            intent: externalIntent,
            sourceText: text,
            userContext: externalUserContext,
            exportFormat: "cursor",
            provider: null,
          })
        : buildCursorInstruction({
            preset: externalIntent,
            sourceText: text,
            userContext: externalUserContext,
          });

      await copyTextToClipboard(instruction);
      setCursorFeedback(true);
      setTimeout(() => setCursorFeedback(false), 1800);
    } catch {
      // Clipboard or network failure; avoid throwing into React event.
    } finally {
      setCopyingCursor(false);
    }
  }, [externalIntent, externalUserContext, generateExternalPrompt, text, validationBlocksExternal]);

  const prepareLabel =
    externalButtonLabel ?? externalIntent?.buttonLabel ?? "Prepare external prompt";

  const openInDisabled =
    validationBlocksExternal || !preparedOpenInPrompt || preparedOpenInPrompt.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl border-white/15 bg-background/78 p-5 backdrop-blur-2xl sm:p-6"
        overlayClassName="bg-black/42 backdrop-blur-xl"
      >
        <DialogHeader>
          <DialogTitle className="text-base font-medium">{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <div
          className={cn(
            "max-h-[62vh] overflow-auto rounded-lg border border-white/10 bg-background-secondary/62 p-3",
            "font-mono text-xs leading-5 text-foreground"
          )}
        >
          {formatHint ? (
            <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {formatHint}
            </p>
          ) : null}
          <pre className="whitespace-pre-wrap break-words">{text}</pre>
        </div>

        {validationBlocksExternal && externalValidation.ok === false ? (
          <p className="text-sm text-destructive" role="alert">
            {externalValidation.message}
          </p>
        ) : null}

        <DialogFooter className="flex flex-wrap items-center justify-end gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-md border border-white/20 px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-foreground"
            type="button"
            onClick={handleCopy}
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : copyLabel}
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-md border border-accent/30 bg-accent/12 px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-accent disabled:opacity-55"
            disabled={exporting}
            type="button"
            onClick={handleExport}
          >
            <Download className="size-3.5" />
            {exporting ? "Exporting..." : exportLabel}
          </button>
          {externalIntent && hasOpenIn ? (
            <>
              <button
                className="inline-flex items-center gap-2 rounded-md border border-sky-400/30 bg-sky-400/12 px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-sky-300 disabled:opacity-55"
                disabled={validationBlocksExternal || preparingOpenIn}
                type="button"
                onClick={handlePrepareOpenIn}
              >
                <ExternalLink className="size-3.5" />
                {preparingOpenIn ? "Preparing…" : prepareFeedback ? "Copied prompt" : prepareLabel}
              </button>
              <OpenInChat
                disabled={openInDisabled || preparingOpenIn}
                presetId={externalIntent.id}
                providers={openInProviders}
                query={preparedOpenInPrompt ?? ""}
              />
            </>
          ) : null}
          {externalIntent && hasCursorClipboard ? (
            <button
              className="inline-flex items-center gap-2 rounded-md border border-white/20 px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-foreground disabled:opacity-55"
              disabled={validationBlocksExternal || copyingCursor}
              type="button"
              onClick={handleCopyCursorInstruction}
            >
              <Copy className="size-3.5" />
              {copyingCursor
                ? "Copying…"
                : cursorFeedback
                  ? "Instruction copied"
                  : hasOpenIn
                    ? "Copy Cursor instruction"
                    : externalIntent.buttonLabel}
            </button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
