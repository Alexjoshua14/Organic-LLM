"use client";

import type { FooterPlacementMap } from "../footer/footer-placement";

import { useState } from "react";
import { Eye, Pencil, SlidersHorizontal, Volume2 } from "lucide-react";

import { useCoreInputControls } from "../core-input-context";
import { hasOverflowItems } from "../footer/footer-placement";

import { ComposerActionButton } from "@/components/chat/composer-action-button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/third-party/ui/dropdown-menu";

type ComposerOverflowMenuProps = {
  /** Items render for every control placed in `"menu"`; see `footer/footer-placement.ts`. */
  placement: FooterPlacementMap;
  className?: string;
};

/**
 * The footer's "more options" menu. It holds whatever `resolveFooterPlacement` sends here,
 * which today is speech and markdown preview on a condensed footer.
 *
 * Toggle state comes from `CoreInputControlsContext`, the same source as the inline chips, so
 * a control reads and writes identically wherever it is placed.
 *
 * To add an item: give the control a `"menu"` placement, then add a block below guarded by
 * `placement.<id> === "menu"`, and include it in `engaged` if it is a toggle.
 */
export function ComposerOverflowMenu({ placement, className }: ComposerOverflowMenuProps) {
  const { useSpeechFriendly, setUseSpeechFriendly, inputMarkdownMode, setInputMarkdownMode } =
    useCoreInputControls();
  const [open, setOpen] = useState(false);

  if (!hasOverflowItems(placement)) return null;

  const showSpeech = placement.speech === "menu";
  const showPreview = placement.preview === "menu";
  const previewing = inputMarkdownMode === "preview";

  // The trigger lights up like an active chip while any toggle inside it is on, so a setting
  // the user can't see on the toolbar still shows that something is engaged.
  const engaged = (showSpeech && useSpeechFriendly) || (showPreview && previewing);

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
            checked={useSpeechFriendly}
            onCheckedChange={(checked) => setUseSpeechFriendly(checked === true)}
          >
            <Volume2 className="size-4" />
            Speech-friendly replies
          </DropdownMenuCheckboxItem>
        ) : null}
        {showPreview ? (
          <DropdownMenuCheckboxItem
            checked={previewing}
            onCheckedChange={() =>
              setInputMarkdownMode((mode) => (mode === "edit" ? "preview" : "edit"))
            }
          >
            {previewing ? <Pencil className="size-4" /> : <Eye className="size-4" />}
            {previewing ? "Back to editing" : "Markdown preview"}
          </DropdownMenuCheckboxItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
