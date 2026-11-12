"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";

import { ComposerActionButton } from "@/components/chat/composer-action-button";
import { ThreadClipboardSubmenu } from "@/components/chat/thread-reference/thread-clipboard-picker";
import {
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  usePromptInputAttachments,
} from "@/components/third-party/ai-elements/prompt-input";
import { DropdownMenuTrigger } from "@/components/third-party/ui/dropdown-menu";

/**
 * The composer's `+` menu: add photos or files, and reference a saved thread. Either entry can
 * be left out: surfaces that take no files (Stage) pass `files={false}`, and `onThreadReference`
 * is omitted where thread references are not supported.
 */
export function ComposerAddFilesButton({
  files = true,
  onThreadReference,
}: {
  files?: boolean;
  onThreadReference?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const attachments = usePromptInputAttachments();
  const engaged = open || (files && attachments.files.length > 0);
  const label = !files
    ? "Reference a thread"
    : attachments.files.length > 0
      ? "Add more files"
      : "Add files";

  return (
    <PromptInputActionMenu open={open} onOpenChange={setOpen}>
      <ComposerActionButton
        engaged={engaged}
        wrapTrigger={DropdownMenuTrigger}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        title={files && onThreadReference ? "Add photos, files, or a thread" : label}
      >
        <PlusIcon className="size-4" />
      </ComposerActionButton>
      <PromptInputActionMenuContent>
        {files ? <PromptInputActionAddAttachments /> : null}
        {onThreadReference ? <ThreadClipboardSubmenu onSelect={onThreadReference} /> : null}
      </PromptInputActionMenuContent>
    </PromptInputActionMenu>
  );
}
