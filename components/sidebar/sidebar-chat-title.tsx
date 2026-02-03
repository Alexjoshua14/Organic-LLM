"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

type SidebarChatTitleProps = {
  title: string;
  editing: boolean;
  onSave: (title: string) => void;
  onEditingChange?: (editing: boolean) => void;
};

const BLUR_GUARD_MS = 600;

export function SidebarChatTitle({
  title,
  editing,
  onSave,
  onEditingChange,
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
        type="text"
        value={editedTitle}
        onChange={(e) => setEditedTitle(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          e.stopPropagation();
          handleKeyDown(e);
        }}
        onClick={(e) => e.stopPropagation()}
        className="flex-1 min-w-0 w-full py-1 bg-transparent outline-none border-b border-foreground/20 focus:border-foreground/50"
      />
    );
  }

  return (
    <h3 className="flex-1 truncate py-1 min-w-0" title={title}>
      {title}
    </h3>
  );
}
