/**
 * DOM adapter for multitask scroll eye-line pinning.
 * Pure geometry lives in `lib/arcadia/multitask/panel-layout.ts`.
 */

import {
  nodeViewportY,
  pickMidpointScrollAnchor,
  scrollTopDeltaToPreserveViewportY,
  type ScrollAnchorRect,
} from "@/lib/arcadia/multitask/panel-layout";

const ANCHOR_SELECTOR = "[data-multitask-scroll-anchor], [data-message-id], [data-arcadia-message]";

export type CapturedScrollPin = {
  scrollEl: HTMLElement;
  id: string;
  /** Viewport Y (relative to scrollport top) to preserve. */
  viewportY: number;
};

function collectAnchorRects(scrollEl: HTMLElement): ScrollAnchorRect[] {
  const nodes = scrollEl.querySelectorAll(ANCHOR_SELECTOR);
  const out: ScrollAnchorRect[] = [];

  nodes.forEach((node, index) => {
    if (!(node instanceof HTMLElement)) return;
    const rect = node.getBoundingClientRect();
    const id =
      node.dataset.multitaskScrollAnchor ||
      node.dataset.messageId ||
      node.dataset.arcadiaMessage ||
      `idx-${index}`;

    out.push({ id, top: rect.top, bottom: rect.bottom });
  });

  // Fallback: direct block children of the scrollport / first content wrapper.
  if (out.length === 0) {
    const root = (scrollEl.firstElementChild as HTMLElement | null) ?? scrollEl;
    const children = root.children;

    for (let i = 0; i < children.length; i++) {
      const child = children[i];

      if (!(child instanceof HTMLElement)) continue;
      const rect = child.getBoundingClientRect();

      out.push({ id: `child-${i}`, top: rect.top, bottom: rect.bottom });
    }
  }

  return out;
}

export function captureScrollPin(scrollEl: HTMLElement | null): CapturedScrollPin | null {
  if (!scrollEl) return null;

  const viewport = scrollEl.getBoundingClientRect();
  const picked = pickMidpointScrollAnchor(
    collectAnchorRects(scrollEl),
    viewport.top,
    scrollEl.clientHeight
  );

  if (!picked) return null;

  return {
    scrollEl,
    id: picked.id,
    viewportY: nodeViewportY(picked.top, viewport.top),
  };
}

function findPinnedElement(scrollEl: HTMLElement, id: string): HTMLElement | null {
  const byData = scrollEl.querySelector(
    `[data-multitask-scroll-anchor="${CSS.escape(id)}"], [data-message-id="${CSS.escape(id)}"], [data-arcadia-message="${CSS.escape(id)}"]`
  );

  if (byData instanceof HTMLElement) return byData;

  if (id.startsWith("child-")) {
    const index = Number(id.slice("child-".length));
    const root = (scrollEl.firstElementChild as HTMLElement | null) ?? scrollEl;
    const child = root.children[index];

    return child instanceof HTMLElement ? child : null;
  }

  if (id.startsWith("idx-")) {
    const index = Number(id.slice("idx-".length));
    const nodes = scrollEl.querySelectorAll(ANCHOR_SELECTOR);
    const node = nodes[index];

    return node instanceof HTMLElement ? node : null;
  }

  return null;
}

/** Adjust scrollTop so the pinned node keeps the same viewport Y. Does not reset scroll. */
export function restoreScrollPin(pin: CapturedScrollPin | null): void {
  if (!pin) return;

  const { scrollEl, id, viewportY } = pin;
  const el = findPinnedElement(scrollEl, id);

  if (!el) return;

  const viewportTop = scrollEl.getBoundingClientRect().top;
  const nodeTop = el.getBoundingClientRect().top;
  const currentY = nodeViewportY(nodeTop, viewportTop);
  const delta = scrollTopDeltaToPreserveViewportY(viewportTop + viewportY, nodeTop);

  // Equivalent: scrollTop += (currentY - viewportY)
  if (Math.abs(currentY - viewportY) < 0.5) return;
  scrollEl.scrollTop += delta;
}

/**
 * Run a layout change while keeping each scrollport's eye-line pinned for the duration.
 */
export function runAnchoredLayoutChange(args: {
  scrollEls: Array<HTMLElement | null>;
  durationMs: number;
  reducedMotion: boolean;
  apply: () => void;
}): void {
  const pins = args.scrollEls
    .map((el) => captureScrollPin(el))
    .filter(Boolean) as CapturedScrollPin[];

  args.apply();

  if (args.reducedMotion || args.durationMs <= 0) {
    pins.forEach(restoreScrollPin);

    return;
  }

  const start = performance.now();

  const tick = (now: number) => {
    pins.forEach(restoreScrollPin);
    if (now - start < args.durationMs) {
      requestAnimationFrame(tick);
    } else {
      pins.forEach(restoreScrollPin);
    }
  };

  requestAnimationFrame(tick);
}
