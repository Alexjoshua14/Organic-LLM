"use client";

import { ErgonDocumentChip } from "./ErgonDocumentChip";
import { ErgonDocumentViewer } from "./ErgonDocumentViewer";

import { ErgonDocumentToolOutputSchema } from "@/lib/schemas/ergon-documents";

type ErgonDocumentToolResultProps = {
  output: unknown;
  isActive: boolean;
};

export function ErgonDocumentToolResult({ output, isActive }: ErgonDocumentToolResultProps) {
  const parsed = ErgonDocumentToolOutputSchema.safeParse(output);

  if (!parsed.success) return null;

  const { action, document, error } = parsed.data;

  if (action === "error") {
    return (
      <div className="not-prose rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        {error ?? "Document tool failed."}
      </div>
    );
  }

  if (!document) return null;

  const showViewer =
    isActive && (action === "created" || action === "updated" || action === "opened");

  if (showViewer) {
    return (
      <ErgonDocumentViewer
        documentId={document.id}
        isActive={isActive}
        title={document.title}
        updatedAt={document.updatedAt}
        version={document.version}
      />
    );
  }

  if (action === "read" || !isActive) {
    return <ErgonDocumentChip action={action} document={document} />;
  }

  return <ErgonDocumentChip action={action} document={document} />;
}
