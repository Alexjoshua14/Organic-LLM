"use client";

import type { ErgonDocument } from "@/lib/schemas/ergon-documents";

import { useCallback, useState } from "react";
import useSWR from "swr";
import { Check, Copy, FileText } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";

import { ErgonDocumentLoadingShell } from "./ErgonDocumentLoadingShell";

import { ChatMessageMarkdown } from "@/components/chat/chat-message-markdown";
import { glass } from "@/components/design-system/primitives";
import { copyTextToClipboard } from "@/lib/clipboard/copy";
import { ERGON_DOC_VIEWER_MOTION } from "@/lib/ergon-documents/viewer-motion";
import { ErgonDocumentSchema } from "@/lib/schemas/ergon-documents";
import { cn } from "@/lib/utils";

async function fetchErgonDocument(id: string): Promise<ErgonDocument> {
  const res = await fetch(`/api/ergon/documents/${id}`);

  if (!res.ok) {
    throw new Error("Failed to load document");
  }

  const json = await res.json();

  return ErgonDocumentSchema.parse(json.document);
}

type ErgonDocumentViewerProps = {
  documentId: string;
  title: string;
  version: number;
  updatedAt: string;
  isActive: boolean;
};

export function ErgonDocumentViewer({
  documentId,
  title,
  version,
  updatedAt,
  isActive,
}: ErgonDocumentViewerProps) {
  const reduceMotion = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const { data, error, isLoading } = useSWR(
    isActive ? ["ergon-document", documentId] : null,
    () => fetchErgonDocument(documentId)
  );

  const handleCopy = useCallback(async () => {
    if (!data?.content) return;

    const ok = await copyTextToClipboard(data.content);

    if (!ok) {
      toast.error("Failed to copy");

      return;
    }

    setCopied(true);
    toast.success("Copied document");
    setTimeout(() => setCopied(false), 2000);
  }, [data?.content]);

  if (!isActive) {
    return null;
  }

  if (isLoading) {
    return <ErgonDocumentLoadingShell title={title} />;
  }

  if (error || !data) {
    return (
      <div className="not-prose rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        Could not load this document.
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={documentId}
        animate={{ opacity: 1, y: 0, height: "auto" }}
        className={cn(
          glass({ opaque: true }),
          "not-prose overflow-hidden rounded-lg border border-border/50"
        )}
        exit={
          reduceMotion
            ? { opacity: 0 }
            : { opacity: 0, y: -4, transition: ERGON_DOC_VIEWER_MOTION.exit }
        }
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        transition={reduceMotion ? { duration: 0 } : ERGON_DOC_VIEWER_MOTION.enter}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border/40 px-3 py-2">
          <div className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              <FileText className="size-3" />
              Linked document
            </span>
            <p className="truncate text-sm font-medium text-foreground">{data.title}</p>
            <p className="text-2xs text-muted-foreground">
              v{version} · updated {new Date(updatedAt).toLocaleString()}
            </p>
          </div>
          <button
            aria-label="Copy document as markdown"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-background-tertiary/60 hover:text-foreground"
            type="button"
            onClick={() => void handleCopy()}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-3 py-3">
          <ChatMessageMarkdown content={data.content} id={documentId} />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
