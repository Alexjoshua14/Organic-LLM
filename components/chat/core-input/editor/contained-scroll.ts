"use client";

import type { RefObject } from "react";

import { useEffect } from "react";

/** Whether `element` scrolls vertically and has room left in the direction of `deltaY`. */
function canScroll(element: HTMLElement, deltaY: number) {
  const { overflowY } = getComputedStyle(element);

  if (overflowY !== "auto" && overflowY !== "scroll") return false;
  if (element.scrollHeight <= element.clientHeight) return false;

  return deltaY < 0
    ? element.scrollTop > 0
    : element.scrollTop + element.clientHeight < element.scrollHeight - 1;
}

/** True when something between `target` and `container` (inclusive) can take this scroll. */
function scrollsInside(container: HTMLElement, target: EventTarget | null, deltaY: number) {
  let node = target instanceof Element ? target : null;

  while (node && container.contains(node)) {
    if (node instanceof HTMLElement && canScroll(node, deltaY)) return true;
    if (node === container) break;
    node = node.parentElement;
  }

  return false;
}

/**
 * Scrolling over `container` stays inside it: a wheel or swipe scrolls whatever inside can still
 * scroll that way (the draft, the slash menu), and at their ends, or over anything that does not
 * scroll, it stops instead of moving the page or the thread behind. Sideways scrolling (a wide
 * code block) is left alone.
 */
export function useContainedScroll(target: HTMLElement | null | RefObject<HTMLElement | null>) {
  useEffect(() => {
    const container = target && "current" in target ? target.current : target;

    if (!container) return;
    let lastX = 0;
    let lastY = 0;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      if (!scrollsInside(container, event.target, event.deltaY)) event.preventDefault();
    };
    const onTouchStart = (event: TouchEvent) => {
      lastX = event.touches[0]?.clientX ?? 0;
      lastY = event.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const x = event.touches[0]!.clientX;
      const y = event.touches[0]!.clientY;
      const deltaX = lastX - x;
      const deltaY = lastY - y;

      lastX = x;
      lastY = y;
      if (!event.cancelable || Math.abs(deltaY) <= Math.abs(deltaX)) return;
      // A drag that extends a text selection (long press, then move) is not a scroll.
      if (window.getSelection()?.isCollapsed === false) return;
      if (!scrollsInside(container, event.target, deltaY)) event.preventDefault();
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: false });

    return () => {
      container.removeEventListener("wheel", onWheel);
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
    };
  }, [target]);
}
