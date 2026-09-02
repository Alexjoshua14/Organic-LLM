"use client";

import type { KanbanPriority } from "@/lib/schemas/kanban";
import type { StoredKanbanItem } from "@/lib/kanban/store";

import { motion } from "framer-motion";
import { FileText } from "lucide-react";

import { KanbanProgressRing } from "./KanbanProgressRing";

import { useErgonDocumentOpen } from "@/components/chat/ergon-documents/ErgonDocumentOpenProvider";
import { cn } from "@/lib/utils";

const PRIORITY_STYLES: Record<KanbanPriority, string> = {
  urgent: "bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30",
  high: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30",
  medium: "bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30",
  low: "bg-muted text-muted-foreground border-border/50",
};

export function KanbanCard({ item }: { item: StoredKanbanItem }) {
  const openCtx = useErgonDocumentOpen();
  const documents = item.documents ?? [];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className={cn(
        "rounded-md border border-border/50 bg-background/60 px-3 py-2",
        "flex items-start gap-2.5"
      )}
    >
      <KanbanProgressRing value={item.progress} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-1.5">
          <p className="text-sm font-medium text-foreground leading-snug flex-1">{item.title}</p>
          {documents.length > 0 ? (
            <FileText aria-hidden className="size-3.5 shrink-0 text-muted-foreground mt-0.5" />
          ) : null}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "rounded-full border px-1.5 py-0.5 text-2xs font-medium capitalize",
              PRIORITY_STYLES[item.priority]
            )}
          >
            {item.priority}
          </span>
          {item.tags?.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-background-tertiary/60 px-1.5 py-0.5 text-2xs text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
        {documents.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {documents.map((doc) => (
              <button
                key={doc.id}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/50 bg-background-tertiary/50 px-2 py-0.5 text-2xs text-muted-foreground hover:bg-background-tertiary hover:text-foreground"
                type="button"
                onClick={() => openCtx?.openDocument(doc)}
              >
                <FileText className="size-2.5 shrink-0" />
                <span className="truncate">{doc.title}</span>
              </button>
            ))}
          </div>
        ) : null}
        {item.notes ? (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{item.notes}</p>
        ) : null}
      </div>
    </motion.div>
  );
}
