"use client";

import { useEffect, useRef } from "react";

import { isEditableEventTarget } from "@/lib/dom/is-editable-event-target";

export type ReplayHotkeyHandlers = {
  onTogglePlay: () => void;
  onRestart: () => void;
  onSeekChapter: (index: number) => void;
  chapterIndex: number;
  chapterCount: number;
};

export type ReplayHotkeyAction =
  | { type: "toggle" }
  | { type: "restart" }
  | { type: "chapter"; index: number };

/** Keys a focused control already owns — its native behavior wins over the replay. */
const ACTIVATION_SELECTOR =
  "button, a[href], summary, input, select, [role='slider'], [role='button'], [role='link'], [role='checkbox'], [role='switch'], [role='menuitem'], [role='option'], [role='tab'], [role='radio']";
const ARROW_SELECTOR =
  "input, select, [role='slider'], [role='radio'], [role='radiogroup'], [role='tab'], [role='tablist'], [role='listbox'], [role='option'], [role='menu'], [role='menuitem'], [role='combobox'], [role='spinbutton'], [role='scrollbar'], [role='tree'], [role='grid']";
/** Inside an open overlay every key belongs to it. */
const OVERLAY_SELECTOR = "[role='dialog'], [role='alertdialog'], [role='menu'], [role='listbox']";

export const REPLAY_HOTKEY_HINT = "Space play/pause · R restart · ← → chapters";

function closest(target: EventTarget | null, selector: string): boolean {
  if (target == null || typeof (target as Node).nodeType !== "number") return false;
  const el = target as Element;

  return typeof el.closest === "function" && el.closest(selector) !== null;
}

/**
 * Map a keydown to a replay action, or `null` when the key belongs to something else:
 * text entry, a focused control's native keys, an open overlay, or a modified chord.
 */
export function replayHotkeyAction(
  event: Pick<
    KeyboardEvent,
    "key" | "target" | "metaKey" | "ctrlKey" | "altKey" | "defaultPrevented"
  >,
  chapterIndex: number,
  chapterCount: number
): ReplayHotkeyAction | null {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return null;
  if (isEditableEventTarget(event.target)) return null;
  if (closest(event.target, OVERLAY_SELECTOR)) return null;

  const key = event.key;

  if (key === " " || key === "Spacebar") {
    if (closest(event.target, ACTIVATION_SELECTOR)) return null;

    return { type: "toggle" };
  }
  if (key === "k" || key === "K") return { type: "toggle" };
  if (key === "r" || key === "R") return { type: "restart" };

  if (key === "ArrowLeft" || key === "ArrowRight") {
    if (closest(event.target, ARROW_SELECTOR)) return null;
    const next = key === "ArrowLeft" ? chapterIndex - 1 : chapterIndex + 1;

    if (next < 0 || next >= chapterCount) return null;

    return { type: "chapter", index: next };
  }

  if (/^[1-9]$/.test(key)) {
    const index = Number(key) - 1;

    return index < chapterCount ? { type: "chapter", index } : null;
  }

  return null;
}

/**
 * Page-level keyboard control for a showcase replay. One replay per page — the showcase
 * routes each host a single stage.
 */
export function useReplayHotkeys(handlers: ReplayHotkeyHandlers, enabled = true) {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const h = handlersRef.current;
      const action = replayHotkeyAction(event, h.chapterIndex, h.chapterCount);

      if (!action) return;
      event.preventDefault();

      if (action.type === "toggle") h.onTogglePlay();
      else if (action.type === "restart") h.onRestart();
      else h.onSeekChapter(action.index);
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
