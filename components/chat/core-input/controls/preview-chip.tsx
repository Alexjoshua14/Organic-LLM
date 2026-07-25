"use client";

import { Eye, Pencil } from "lucide-react";

import { useCoreInputControls } from "../core-input-context";

import { ComposerToolChip } from "@/components/chat/composer-tool-chip";
import { cn } from "@/lib/utils";

export function ComposerPreviewChip() {
  const { showLabels, inputMarkdownMode, setInputMarkdownMode } = useCoreInputControls();
  const isEditing = inputMarkdownMode === "edit";

  return (
    <ComposerToolChip
      active={inputMarkdownMode === "preview"}
      aria-label={isEditing ? "Show markdown preview" : "Back to editing"}
      title={isEditing ? "Show rendered markdown" : "Edit as plain text"}
      tool="preview"
      onClick={() => setInputMarkdownMode((mode) => (mode === "edit" ? "preview" : "edit"))}
    >
      {isEditing ? <Eye className="size-4" /> : <Pencil className="size-4" />}
      <span className={cn(showLabels ? "inline-flex" : "hidden")}>
        {isEditing ? "Preview" : "Edit"}
      </span>
    </ComposerToolChip>
  );
}
