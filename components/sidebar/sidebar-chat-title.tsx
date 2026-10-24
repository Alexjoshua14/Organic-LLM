"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

import { ThreadTitleLine, useThreadTitlePhase } from "@/components/chat/thread-title-line";

type SidebarChatTitleProps = {
  threadId: string;
  title: string;
  editing: boolean;
  onSave: (title: string) => void;
  onEditingChange?: (editing: boolean) => void;
  className?: string;
};

const BLUR_GUARD_MS = 600;

export function SidebarChatTitle({
  threadId,
  title,
  editing,
  onSave,
  onEditingChange,
  className,
}: SidebarChatTitleProps) {
  const { phase, shown, announced, from, to } = useThreadTitlePhase(threadId, title);
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

  return (
    <h3 className="thread-title min-w-0 flex-1 cursor-pointer truncate py-1" title={announced}>
      <span className="sr-only">{announced}</span>
      <ThreadTitleLine className={className} from={from} phase={phase} text={shown} to={to} />
    </h3>
  );
}
