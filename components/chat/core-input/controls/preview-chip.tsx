"use client";

import { Eye, Pencil } from "lucide-react";

import { useCoreInputControls } from "../core-input-context";

import { ComposerToolChip } from "@/components/chat/composer-tool-chip";
import { cn } from "@/lib/utils";

export function ComposerPreviewChip() {
  const { inputMarkdownMode, setInputMarkdownMode } = useCoreInputControls();
  const isEditing = inputMarkdownMode === "edit";

  return (
    <ComposerToolChip
      active={!isEditing}
      aria-label={isEditing ? "Show markdown preview" : "Back to editing"}
      chip="preview"
      className={cn(
        "h-6 w-6 min-w-6 rounded-sm [&_svg]:size-3.5",
        // Idle preview sits a tier below the other toggles; the engaged state
        // still resolves to `text-foreground` from the chip base.
        isEditing && "text-muted-foreground/40 dark:text-muted-foreground/50"
      )}
      size="icon-xs"
      title={isEditing ? "Show rendered markdown" : "Edit as plain text"}
      onClick={() => setInputMarkdownMode((mode) => (mode === "edit" ? "preview" : "edit"))}
    >
      {isEditing ? <Eye /> : <Pencil />}
    </ComposerToolChip>
  );
}
