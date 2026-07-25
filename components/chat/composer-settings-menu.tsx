"use client";

import { useMemo, useState } from "react";
import { Eye, Loader2, Pencil, SlidersHorizontal, Volume2 } from "lucide-react";

import { ComposerActionButton } from "./composer-action-button";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/third-party/ui/dropdown-menu";

type ComposerSettingsMenuProps = {
  useSpeechFriendly?: boolean;
  onSpeechFriendlyChange?: (value: boolean) => void;
  inputMarkdownMode?: "edit" | "preview";
  onMarkdownModeToggle?: () => void;
  enableMarkdownInputPreview?: boolean;
  onSecondarySubmit?: () => void;
  secondarySubmitLabel?: string;
  secondarySubmitDisabled?: boolean;
  secondarySubmitPending?: boolean;
  hasDraft?: boolean;
  className?: string;
};

/** Overflow for less-used composer tools. Model/effort stay on the toolbar. */
export function ComposerSettingsMenu({
  useSpeechFriendly,
  onSpeechFriendlyChange,
  inputMarkdownMode = "edit",
  onMarkdownModeToggle,
  enableMarkdownInputPreview = false,
  onSecondarySubmit,
  secondarySubmitLabel = "Steer assist",
  secondarySubmitDisabled = false,
  secondarySubmitPending = false,
  hasDraft = false,
  className,
}: ComposerSettingsMenuProps) {
  const [open, setOpen] = useState(false);

  const showSpeech = onSpeechFriendlyChange != null;
  const showPreview = enableMarkdownInputPreview && onMarkdownModeToggle != null;
  const showSteer = Boolean(onSecondarySubmit);

  const hasItems = showSpeech || showPreview || showSteer;

  const engaged = useMemo(() => {
    return useSpeechFriendly === true || inputMarkdownMode === "preview";
  }, [inputMarkdownMode, useSpeechFriendly]);

  if (!hasItems) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <ComposerActionButton
        wrapTrigger={DropdownMenuTrigger}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="More composer options"
        engaged={engaged || open}
        title="Speech, preview, and more"
        className={className}
      >
        <SlidersHorizontal className="size-4" />
      </ComposerActionButton>
      <DropdownMenuContent
        align="end"
        className="w-[min(17rem,calc(100vw-2rem))]"
        side="top"
        sideOffset={8}
      >
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          More options
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {showSpeech ? (
          <DropdownMenuCheckboxItem
            checked={useSpeechFriendly === true}
            onCheckedChange={(checked) => onSpeechFriendlyChange?.(checked === true)}
          >
            <Volume2 className="size-4" />
            Speech-friendly replies
          </DropdownMenuCheckboxItem>
        ) : null}
        {showPreview ? (
          <DropdownMenuCheckboxItem
            checked={inputMarkdownMode === "preview"}
            onCheckedChange={() => onMarkdownModeToggle?.()}
          >
            {inputMarkdownMode === "edit" ? (
              <Eye className="size-4" />
            ) : (
              <Pencil className="size-4" />
            )}
            {inputMarkdownMode === "edit" ? "Markdown preview" : "Back to editing"}
          </DropdownMenuCheckboxItem>
        ) : null}
        {showSteer ? (
          <DropdownMenuItem
            disabled={secondarySubmitDisabled || secondarySubmitPending || !hasDraft}
            onSelect={(event) => {
              event.preventDefault();
              if (secondarySubmitDisabled || secondarySubmitPending || !hasDraft) return;
              setOpen(false);
              onSecondarySubmit?.();
            }}
          >
            {secondarySubmitPending ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : null}
            {secondarySubmitLabel}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
