"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { moveFocusedTaskIndex } from "@/lib/ergon/task-row-keyboard";

export type ErgonTaskRowKeyboardProps = {
  isFocused: boolean;
  tabIndex: number;
  setRowRef: (element: HTMLElement | null) => void;
  onFocus: () => void;
  onNavigate: (action: "next" | "prev" | "first" | "last") => void;
};

export type UseErgonTaskListKeyboardResult = {
  focusedTaskId: string | null;
  getRowProps: (taskId: string) => ErgonTaskRowKeyboardProps;
};

/**
 * Roving-tabindex keyboard navigation for the Ergon task list.
 * The first visible row is the tab stop until the user moves focus.
 */
export function useErgonTaskListKeyboard(
  orderedTaskIds: string[]
): UseErgonTaskListKeyboardResult {
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const refCallbacks = useRef(new Map<string, (element: HTMLElement | null) => void>());

  const effectiveFocusedId =
    focusedTaskId && orderedTaskIds.includes(focusedTaskId)
      ? focusedTaskId
      : (orderedTaskIds[0] ?? null);

  const focusTaskAt = useCallback(
    (index: number) => {
      const id = orderedTaskIds[index];

      if (!id) return;

      setFocusedTaskId(id);
      rowRefs.current.get(id)?.focus();
    },
    [orderedTaskIds]
  );

  const navigate = useCallback(
    (fromId: string, action: "next" | "prev" | "first" | "last") => {
      const currentIndex = orderedTaskIds.indexOf(fromId);
      const nextIndex = moveFocusedTaskIndex(currentIndex, action, orderedTaskIds.length);

      focusTaskAt(nextIndex);
    },
    [focusTaskAt, orderedTaskIds]
  );

  const getRefCallback = useCallback((taskId: string) => {
    let callback = refCallbacks.current.get(taskId);

    if (!callback) {
      callback = (element: HTMLElement | null) => {
        if (element) rowRefs.current.set(taskId, element);
        else rowRefs.current.delete(taskId);
      };
      refCallbacks.current.set(taskId, callback);
    }

    return callback;
  }, []);

  const getRowProps = useCallback(
    (taskId: string): ErgonTaskRowKeyboardProps => ({
      isFocused: effectiveFocusedId === taskId,
      tabIndex: effectiveFocusedId === taskId ? 0 : -1,
      setRowRef: getRefCallback(taskId),
      onFocus: () => setFocusedTaskId(taskId),
      onNavigate: (action) => navigate(taskId, action),
    }),
    [effectiveFocusedId, getRefCallback, navigate]
  );

  useEffect(() => {
    const validIds = new Set(orderedTaskIds);

    for (const id of rowRefs.current.keys()) {
      if (!validIds.has(id)) rowRefs.current.delete(id);
    }
  }, [orderedTaskIds]);

  return { focusedTaskId: effectiveFocusedId, getRowProps };
}
