import type { KeyboardEvent } from "react";

export type ErgonTaskRowKeyAction =
  | "next"
  | "prev"
  | "first"
  | "last"
  | "toggleExpand"
  | "collapse"
  | "complete"
  | "active"
  | "edit"
  | "delete"
  | "chatAbout";

type TaskRowKeyOptions = {
  key: string;
  expanded: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
};

const NAVIGATION_ACTIONS: ReadonlySet<ErgonTaskRowKeyAction> = new Set([
  "next",
  "prev",
  "first",
  "last",
]);

/** Pure key -> action mapping for a focused task row (no DOM access). */
export function resolveTaskRowKeyAction(options: TaskRowKeyOptions): ErgonTaskRowKeyAction | null {
  const { key, expanded, metaKey, ctrlKey, altKey } = options;

  if (metaKey || ctrlKey || altKey) return null;

  switch (key) {
    case "ArrowDown":
    case "j":
      return "next";
    case "ArrowUp":
    case "k":
      return "prev";
    case "Home":
      return "first";
    case "End":
      return "last";
    case "Enter":
      return "toggleExpand";
    case " ":
    case "Spacebar":
      return "complete";
    case "a":
    case "A":
      return "active";
    case "e":
    case "E":
      return "edit";
    case "Delete":
    case "Backspace":
      return "delete";
    case "Escape":
      return expanded ? "collapse" : null;
    case "c":
    case "C":
      return "chatAbout";
    default:
      return null;
  }
}

export function isNavigationAction(action: ErgonTaskRowKeyAction): boolean {
  return NAVIGATION_ACTIONS.has(action);
}

/** Resolve a React keydown event into a row action, calling preventDefault when handled. */
export function handleTaskRowKeyDown(
  event: KeyboardEvent,
  options: { expanded: boolean }
): ErgonTaskRowKeyAction | null {
  const action = resolveTaskRowKeyAction({
    key: event.key,
    expanded: options.expanded,
    metaKey: event.metaKey,
    ctrlKey: event.ctrlKey,
    altKey: event.altKey,
  });

  if (!action) return null;

  event.preventDefault();

  return action;
}

/** Compute the next focused index for roving keyboard navigation. */
export function moveFocusedTaskIndex(
  currentIndex: number,
  action: "next" | "prev" | "first" | "last",
  length: number
): number {
  if (length <= 0) return -1;

  switch (action) {
    case "first":
      return 0;
    case "last":
      return length - 1;
    case "next":
      return Math.min(length - 1, currentIndex + 1);
    case "prev":
      return Math.max(0, currentIndex - 1);
    default:
      return currentIndex;
  }
}
