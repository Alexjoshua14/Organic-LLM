"use client";

import type { PointerEvent as ReactPointerEvent } from "react";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  ERGON_SWIPE_START_PX,
  clampSwipeOffset,
  getSwipePreview,
  isScrollDominant,
  resolveSwipeAction,
  type ErgonSwipePreview,
} from "@/lib/ergon/task-row-gestures";

/** Touch-only gate: gestures run on coarse-pointer phones, never on hover-capable desktops. */
const TOUCH_MEDIA_QUERY = "(hover: none) and (max-width: 767px)";

function useTouchGestureEnabled(override?: boolean): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (override !== undefined) {
      setEnabled(override);

      return;
    }

    if (typeof window.matchMedia !== "function") return;

    const mql = window.matchMedia(TOUCH_MEDIA_QUERY);
    const onChange = () => setEnabled(mql.matches);

    onChange();
    mql.addEventListener("change", onChange);

    return () => mql.removeEventListener("change", onChange);
  }, [override]);

  return override ?? enabled;
}

type UseTaskRowGesturesOptions = {
  onComplete: () => void;
  onActive: () => void;
  onDelete: () => void;
  /** Force-enable for tests; otherwise resolved from the touch media query. */
  enabled?: boolean;
};

type GestureState = {
  pointerId: number | null;
  startX: number;
  startY: number;
  rowWidth: number;
  axis: "x" | "y" | null;
  suppressClick: boolean;
};

function createGestureState(): GestureState {
  return {
    pointerId: null,
    startX: 0,
    startY: 0,
    rowWidth: 0,
    axis: null,
    suppressClick: false,
  };
}

export type TaskRowGestureHandlers = {
  onPointerDown: (event: ReactPointerEvent) => void;
  onPointerMove: (event: ReactPointerEvent) => void;
  onPointerUp: (event: ReactPointerEvent) => void;
  onPointerCancel: (event: ReactPointerEvent) => void;
  onClickCapture: (event: { stopPropagation: () => void; preventDefault: () => void }) => void;
};

export type UseTaskRowGesturesResult = {
  enabled: boolean;
  offset: number;
  preview: ErgonSwipePreview;
  swiping: boolean;
  setRowElement: (element: HTMLElement | null) => void;
  handlers: TaskRowGestureHandlers | null;
};

/**
 * Pointer-event swipe handling for a single task row (touch only).
 * Threshold logic lives in {@link "@/lib/ergon/task-row-gestures"} for testability.
 * Tap / double-tap is handled by the row's title button, not here.
 */
export function useTaskRowGestures(options: UseTaskRowGesturesOptions): UseTaskRowGesturesResult {
  const enabled = useTouchGestureEnabled(options.enabled);
  const [offset, setOffset] = useState(0);
  const [preview, setPreview] = useState<ErgonSwipePreview>(null);
  const [swiping, setSwiping] = useState(false);
  const elementRef = useRef<HTMLElement | null>(null);
  const stateRef = useRef<GestureState>(createGestureState());

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const reset = useCallback(() => {
    stateRef.current.pointerId = null;
    stateRef.current.axis = null;
    setOffset(0);
    setPreview(null);
    setSwiping(false);
  }, []);

  const setRowElement = useCallback((element: HTMLElement | null) => {
    elementRef.current = element;
  }, []);

  const onPointerDown = useCallback((event: ReactPointerEvent) => {
    if (event.pointerType === "mouse") return;

    const state = stateRef.current;

    state.pointerId = event.pointerId;
    state.startX = event.clientX;
    state.startY = event.clientY;
    state.rowWidth = elementRef.current?.getBoundingClientRect().width ?? 0;
    state.axis = null;
    state.suppressClick = false;
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent) => {
    const state = stateRef.current;

    if (state.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - state.startX;
    const deltaY = event.clientY - state.startY;

    if (state.axis === null) {
      if (Math.abs(deltaX) < ERGON_SWIPE_START_PX && Math.abs(deltaY) < ERGON_SWIPE_START_PX) {
        return;
      }

      if (isScrollDominant(deltaX, deltaY)) {
        state.axis = "y";

        return;
      }

      state.axis = "x";
      setSwiping(true);
      elementRef.current?.setPointerCapture?.(event.pointerId);
    }

    if (state.axis !== "x") return;

    setOffset(clampSwipeOffset(deltaX, state.rowWidth));
    setPreview(getSwipePreview(deltaX, state.rowWidth));

    if (event.cancelable) event.preventDefault();
  }, []);

  const onPointerUp = useCallback(
    (event: ReactPointerEvent) => {
      const state = stateRef.current;

      if (state.pointerId !== event.pointerId) {
        reset();

        return;
      }

      if (state.axis === "x") {
        const deltaX = event.clientX - state.startX;
        const action = resolveSwipeAction(deltaX, state.rowWidth);

        state.suppressClick = true;

        if (action === "complete") optionsRef.current.onComplete();
        else if (action === "active") optionsRef.current.onActive();
        else if (action === "delete") optionsRef.current.onDelete();
      }

      reset();
    },
    [reset]
  );

  const onPointerCancel = useCallback(() => {
    reset();
  }, [reset]);

  const onClickCapture = useCallback(
    (event: { stopPropagation: () => void; preventDefault: () => void }) => {
      if (!stateRef.current.suppressClick) return;

      stateRef.current.suppressClick = false;
      event.stopPropagation();
      event.preventDefault();
    },
    []
  );

  return {
    enabled,
    offset,
    preview,
    swiping,
    setRowElement,
    handlers: enabled
      ? { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClickCapture }
      : null,
  };
}
