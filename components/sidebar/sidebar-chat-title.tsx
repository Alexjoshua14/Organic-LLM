"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";


export const SidebarChatTitle = ({ title, onSave, editable }: { title: string, onSave: (title: string) => void, editable?: boolean }) => {
  const [editing, setEditing] = useState<boolean>(false);
  const [editedTitle, setEditedTitle] = useState<string>(title);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync with prop changes
  useEffect(() => {
    if (!editing) {
      setEditedTitle(title);
    }
  }, [title, editing]);

  // Auto-focus and select when entering edit mode
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleEdit = useCallback(() => {
    setEditing(true);
  }, []);

  const handleSave = useCallback(() => {
    if (editedTitle.trim() === "") {
      setEditedTitle(title);
      return;
    }
    onSave(editedTitle.trim());
  }, [editedTitle, title, onSave]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setEditedTitle(title);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editedTitle}
        onChange={(e) => setEditedTitle(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        className="flex-1 w-full py-1 bg-transparent outline-none border-b border-foreground/20 focus:border-foreground/50"
      />
    );
  }

  return (
    <h3
      className="flex-1 truncate py-1"
      onDoubleClick={editable ? handleEdit : undefined}
    >
      {title}
    </h3>
  );
};