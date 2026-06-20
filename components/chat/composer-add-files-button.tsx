"use client";

import { useState } from "react";

import { PlusIcon } from "lucide-react";

import {
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  usePromptInputAttachments,
} from "@/components/third-party/ai-elements/prompt-input";
import { DropdownMenuTrigger } from "@/components/third-party/ui/dropdown-menu";

import { ComposerActionButton } from "./composer-action-button";

export function ComposerAddFilesButton() {
  const [open, setOpen] = useState(false);
  const attachments = usePromptInputAttachments();
  const engaged = open || attachments.files.length > 0;

  return (
    <PromptInputActionMenu open={open} onOpenChange={setOpen}>
      <ComposerActionButton
        engaged={engaged}
        wrapTrigger={DropdownMenuTrigger}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={attachments.files.length > 0 ? "Add more files" : "Add files"}
        title="Add photos or files"
      >
        <PlusIcon className="size-4" />
      </ComposerActionButton>
      <PromptInputActionMenuContent>
        <PromptInputActionAddAttachments />
      </PromptInputActionMenuContent>
    </PromptInputActionMenu>
  );
}
