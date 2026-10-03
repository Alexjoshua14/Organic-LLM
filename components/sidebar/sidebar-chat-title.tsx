"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

import { ProcessingTextBurn } from "@/components/chat/processing-text-burn";
import { PROCESSING_TEXT_BURN_TITLE_REGEN_LOOP_S } from "@/lib/chat/processing-text-burn-timing";
import { cn } from "@/lib/utils";

type SidebarChatTitleProps = {
  title: string;
  editing: boolean;
  onSave: (title: string) => void;
  onEditingChange?: (editing: boolean) => void;
  className?: string;
  /** AI title regeneration in flight for this thread. */
  regenerating?: boolean;
  /** API has returned; burn to the (possibly new) title on the next loop boundary. */
  commitRegen?: boolean;
  /** Called after the commit burn sweep settles. */
  onRegenCommitSettled?: () => void;
};

const BLUR_GUARD_MS = 600;

export function SidebarChatTitle({
  title,
  editing,
  onSave,
  onEditingChange,
  className,
  regenerating = false,
  commitRegen = false,
  onRegenCommitSettled,
}: SidebarChatTitleProps) {
  const [editedTitle, setEditedTitle] = useState<string>(title);
  const inputRef = useRef<HTMLInputElement>(null);
  const editStartedAtRef = useRef(0);

  useEffect(() => {
    if (!editing) {
      setEditedTitle(title);
    }
  }, [title, editing]);

  useEffect(() => {
    if (!editing) return;
    editStartedAtRef.current = Date.now();
    const id = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 100);

    return () => clearTimeout(id);
  }, [editing]);

  const handleSave = useCallback(() => {
    if (editedTitle.trim() === "") {
      setEditedTitle(title);
    } else {
      onSave(editedTitle.trim());
    }
    onEditingChange?.(false);
  }, [editedTitle, title, onSave, onEditingChange]);

  const handleBlur = useCallback(() => {
    const elapsed = Date.now() - editStartedAtRef.current;

    if (elapsed < BLUR_GUARD_MS) {
      // Refocus so user can type; something (dropdown, etc.) stole focus.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          inputRef.current?.focus();
        });
      });

      return;
    }
    handleSave();
  }, [handleSave]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditedTitle(title);
      onEditingChange?.(false);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={[
          "flex-1 min-w-0 w-full py-1 bg-transparent outline-none border-b border-foreground/20 focus:border-foreground/50",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        type="text"
        value={editedTitle}
        onBlur={handleBlur}
        onChange={(e) => setEditedTitle(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          handleKeyDown(e);
        }}
      />
    );
  }

  if (regenerating) {
    return (
      <ProcessingTextBurn
        as="span"
        className={cn("flex-1 truncate py-1 min-w-0 block", className)}
        commitOnNextSweep={commitRegen}
        loopSweepIntervalS={PROCESSING_TEXT_BURN_TITLE_REGEN_LOOP_S}
        text={title}
        onCommitSweepSettled={onRegenCommitSettled}
      />
    );
  }

  return (
    <h3
      className={["flex-1 truncate py-1 min-w-0 cursor-pointer", className]
        .filter(Boolean)
        .join(" ")}
      title={title}
    >
      {title}
    </h3>
  );
}
