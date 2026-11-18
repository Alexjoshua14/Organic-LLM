import type { Editor } from "@tiptap/core";

/**
 * The compact composer is one line until the text stops fitting, then stacks (editor on top,
 * actions below). Everything that changes place moves together: the text, the three actions and
 * the row's own height. If any one of them snapped, the rest would read as a jolt.
 */

/** Stacking is the "entrance": a little longer so the eye can follow where things went. */
export const COMPOSER_EXPAND_MS = 220;
/** Returning to one line is the "exit": quicker, the same rule the rest of the app follows. */
export const COMPOSER_COLLAPSE_MS = 170;
/** Soft start, long settle. A hard decelerate starts at full speed, which is what read as abrupt. */
export const COMPOSER_REFLOW_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";
/** Each action starts this much after the one before it, so they trail rather than move as a block. */
export const COMPOSER_REFLOW_STAGGER_MS = 24;
/** Back to one line only once the text clears the narrow width by this much, so it cannot flap. */
export const COMPOSER_FIT_SLACK_PX = 16;

/** Stacking sends the actions down first and the settings last; returning reverses it. */
const REFLOW_ORDER = ["area", "send", "trail", "lead"] as const;

export type ReflowSnapshot = {
  height: number;
  items: Map<string, { x: number; y: number }>;
};

/** Positions of what moves, relative to the row, so scrolling cannot skew the glide. */
export function snapshotReflow(row: HTMLElement): ReflowSnapshot {
  const origin = row.getBoundingClientRect();
  const items: ReflowSnapshot["items"] = new Map();

  for (const item of row.querySelectorAll<HTMLElement>("[data-reflow]")) {
    const rect = item.getBoundingClientRect();

    items.set(item.dataset.reflow ?? "", { x: rect.left - origin.left, y: rect.top - origin.top });
  }

  return { height: origin.height, items };
}

/** Moves everything from where it was to where the new layout put it, and tweens the row's height. */
export function playReflow(row: HTMLElement, from: ReflowSnapshot, expanding: boolean) {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  if (typeof row.animate !== "function") return;
  const origin = row.getBoundingClientRect();
  const duration = expanding ? COMPOSER_EXPAND_MS : COMPOSER_COLLAPSE_MS;
  const order = expanding ? REFLOW_ORDER : [...REFLOW_ORDER].reverse();

  for (const item of row.querySelectorAll<HTMLElement>("[data-reflow]")) {
    const key = item.dataset.reflow ?? "";
    const before = from.items.get(key);

    if (!before) continue;
    const rect = item.getBoundingClientRect();
    const dx = before.x - (rect.left - origin.left);
    const dy = before.y - (rect.top - origin.top);

    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
    item.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], {
      duration,
      delay:
        Math.max(0, order.indexOf(key as (typeof REFLOW_ORDER)[number])) *
        COMPOSER_REFLOW_STAGGER_MS,
      easing: COMPOSER_REFLOW_EASING,
      fill: "backwards",
    });
  }
  // The shell follows the row, so tweening its height grows the whole composer instead of snapping.
  if (Math.abs(from.height - origin.height) >= 0.5) {
    row.animate(
      [
        { height: `${from.height}px`, overflow: "clip" },
        { height: `${origin.height}px`, overflow: "clip" },
      ],
      { duration, easing: COMPOSER_REFLOW_EASING }
    );
  }
}

let measurer: CanvasRenderingContext2D | null | undefined;

/** Width `text` takes on one line in `element`'s font; 0 where nothing can be measured (tests). */
function textWidth(text: string, element: Element) {
  if (measurer === undefined) {
    try {
      measurer = document.createElement("canvas").getContext("2d");
    } catch {
      measurer = null;
    }
  }
  if (!measurer) return 0;
  measurer.font = getComputedStyle(element).font;

  return measurer.measureText(text).width;
}

/** Width the text has on one line: the row minus the actions, which hold their size either way. */
function singleLineTextWidth(row: HTMLElement) {
  const style = getComputedStyle(row);
  const gap = parseFloat(style.columnGap) || 0;
  // The one-line layout pads the text with a token; a hidden probe resolves it to pixels.
  const probe = row.querySelector("[data-pad-probe]");
  const inlinePad = probe ? parseFloat(getComputedStyle(probe).paddingLeft) || 0 : 0;
  let used = 0;
  let items = 0;

  // The editor itself is what is being fitted, so only the actions count against its width.
  for (const item of row.querySelectorAll<HTMLElement>("[data-reflow]:not([data-reflow='area'])")) {
    const margin = getComputedStyle(item);

    used +=
      item.offsetWidth +
      (parseFloat(margin.marginLeft) || 0) +
      (parseFloat(margin.marginRight) || 0);
    items += 1;
  }

  return row.clientWidth - used - gap * items - inlinePad * 2;
}

/**
 * Whether the composer should be stacked: anything beyond a single plain line (several blocks, a
 * Shift+Enter break, a list, a code block), or a line too long for the one-row layout.
 */
export function wantsExpanded(
  editor: Editor,
  row: HTMLElement,
  forced: boolean,
  expanded: boolean
): boolean {
  if (forced) return true;
  const { doc } = editor.state;
  const first = doc.firstChild;

  if (doc.childCount !== 1 || first?.type.name !== "paragraph") return true;
  let broken = false;

  first.forEach((child) => {
    if (child.type.name === "hardBreak") broken = true;
  });
  if (broken) return true;
  const line = editor.view.dom.firstElementChild;

  if (!line) return false;
  // An empty line shows the placeholder, which has to fit the one-line layout like typed text.
  if (!first.content.size) {
    const width = textWidth(line.getAttribute("data-placeholder") ?? "", line);

    return width > 0 && width > singleLineTextWidth(row) - (expanded ? COMPOSER_FIT_SLACK_PX : 0);
  }
  const range = document.createRange();

  // No layout engine (tests, server render): nothing can be measured, so the line is taken to fit.
  if (typeof range.getBoundingClientRect !== "function") return false;
  range.selectNodeContents(line);
  const box = range.getBoundingClientRect();
  const lineHeight = parseFloat(getComputedStyle(line).lineHeight) || 24;
  const slack = expanded ? COMPOSER_FIT_SLACK_PX : 0;

  return box.height >= lineHeight * 1.5 || box.width > singleLineTextWidth(row) - slack;
}
