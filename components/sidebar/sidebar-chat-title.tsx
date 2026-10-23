"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { SESSION_TITLE_SETTLE_S } from "@/lib/sidebar/session-signal-timing";

type SidebarChatTitleProps = {
  title: string;
  editing: boolean;
  onSave: (title: string) => void;
  onEditingChange?: (editing: boolean) => void;
  className?: string;
};

const BLUR_GUARD_MS = 600;

export function SidebarChatTitle({
  title,
  editing,
  onSave,
  onEditingChange,
  className,
}: SidebarChatTitleProps) {
  const [editedTitle, setEditedTitle] = useState<string>(title);
  const inputRef = useRef<HTMLInputElement>(null);
  const editStartedAtRef = useRef(0);
  const reduceMotion = useReducedMotion();
  // A title that changes in place (regenerated, or first auto-title) settles in rather than
  // snapping, so the eye registers that the new words are the answer.
  const shownTitleRef = useRef(title);
  const titleChanged = shownTitleRef.current !== title;

  useEffect(() => {
    shownTitleRef.current = title;
  }, [title]);

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

  // The heading itself animates, never a wrapper inside it: gradient titles (Arcadia) paint with
  // `bg-clip-text text-transparent`, and a filtered child is composited on its own layer where
  // the parent's clipped background cannot reach — the text would render fully transparent.
  return (
    <motion.h3
      key={title}
      animate={{ opacity: 1, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
      className={["flex-1 truncate py-1 min-w-0 cursor-pointer", className]
        .filter(Boolean)
        .join(" ")}
      initial={titleChanged && !reduceMotion ? { opacity: 0, filter: "blur(3px)" } : false}
      title={title}
      transition={{ duration: SESSION_TITLE_SETTLE_S, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {title}
    </motion.h3>
  );
}
