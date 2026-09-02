"use client";

import type { ErgonDocumentSummary } from "@/lib/schemas/ergon-documents";

import { FileText } from "lucide-react";

import { useErgonDocumentOpen } from "./ErgonDocumentOpenProvider";

import {
  ToolResultInlineRow,
  toolResultSummaryButtonClass,
} from "@/components/chat/tool-result-inline";

type ErgonDocumentChipProps = {
  action: "created" | "updated" | "read" | "opened";
  document: ErgonDocumentSummary;
  version?: number;
};

function chipLabel(action: ErgonDocumentChipProps["action"], title: string, version?: number): string {
  switch (action) {
    case "created":
      return `Created ${title}`;
    case "updated":
      return version != null ? `Updated ${title} · v${version}` : `Updated ${title}`;
    case "read":
      return `Read ${title}`;
    case "opened":
      return `Opened ${title}`;
  }
}

export function ErgonDocumentChip({ action, document, version }: ErgonDocumentChipProps) {
  const openCtx = useErgonDocumentOpen();
  const label = chipLabel(action, document.title, version ?? document.version);

  return (
    <ToolResultInlineRow>
      <button
        className={`${toolResultSummaryButtonClass} inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background-tertiary/40 px-2.5 py-1`}
        type="button"
        onClick={() => openCtx?.openDocument(document)}
      >
        <FileText className="size-3 shrink-0" />
        <span className="truncate">{label}</span>
      </button>
    </ToolResultInlineRow>
  );
}
