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
/** The text fades up from this opacity as it settles, softening its instant re-wrap. */
export const COMPOSER_REFLOW_AREA_FADE_FROM = 0.4;
/**
 * The actions are fully faded at this share of their path left to travel (offset 1 − this), so
 * they never visibly slide across the text, then fade back in as they land.
 */
export const COMPOSER_REFLOW_DIP_AT = 0.6;
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
    const timing: KeyframeAnimationOptions = {
      duration,
      delay:
        Math.max(0, order.indexOf(key as (typeof REFLOW_ORDER)[number])) *
        COMPOSER_REFLOW_STAGGER_MS,
      easing: COMPOSER_REFLOW_EASING,
      fill: "backwards",
    };

    if (key === "area") {
      // The text re-wraps to its new width at once, so sliding it sideways would drag
      // full-width text under the buttons. It only settles vertically, fading up as it lands.
      item.animate(
        [
          { transform: `translateY(${dy}px)`, opacity: COMPOSER_REFLOW_AREA_FADE_FROM },
          { transform: "none", opacity: 1 },
        ],
        timing
      );
      continue;
    }
    // The actions cross over the text on their way, so they dip out and land back in.
    item.animate(
      [
        { transform: `translate(${dx}px, ${dy}px)`, opacity: 1 },
        {
          transform: `translate(${dx * COMPOSER_REFLOW_DIP_AT}px, ${dy * COMPOSER_REFLOW_DIP_AT}px)`,
          opacity: 0,
          offset: 1 - COMPOSER_REFLOW_DIP_AT,
        },
        { transform: "none", opacity: 1 },
      ],
      timing
    );
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

/**
 * What the reflow remembers between measurements. Created once per composer
 * (`createReflowMemo`) and passed to every `wantsExpanded` call.
 */
export type ReflowMemo = {
  /** Room for text on one line, measured from the editor while it was last on one line. */
  oneLineRoom: number;
  /** The row's width at that measurement, so a resize can shift the room by the same amount. */
  rowWidth: number;
  /** Draft length when it stacked because it wrapped; only a shorter draft may return to one line. */
  lengthAtStack: number;
};

export function createReflowMemo(): ReflowMemo {
  return { oneLineRoom: 0, rowWidth: 0, lengthAtStack: Infinity };
}

/**
 * Whether the composer should be stacked: anything beyond a single plain line (several blocks, a
 * Shift+Enter break, a list, a code block), or a line that no longer fits the one-line layout.
 *
 * Nothing here is estimated. On one line, it stacks only when the text really wraps. Stacked, it
 * returns to one line only after the draft got shorter than when it stacked, and only if the
 * text clears the one-line room measured before stacking by `COMPOSER_FIT_SLACK_PX`. So typing
 * can never bounce between the layouts, whatever the exact widths are.
 */
export function wantsExpanded(
  editor: Editor,
  row: HTMLElement,
  forced: boolean,
  expanded: boolean,
  memo: ReflowMemo
): boolean {
  const stack = (wrapped: boolean, length: number) => {
    // Stacking for a wrap remembers the length; any other reason lets it return once it fits.
    if (!expanded) memo.lengthAtStack = wrapped ? length : Infinity;

    return true;
  };

  if (forced) return expanded || stack(false, 0);
  const { doc } = editor.state;
  const first = doc.firstChild;

  if (doc.childCount !== 1 || first?.type.name !== "paragraph") return expanded || stack(false, 0);
  let broken = false;

  first.forEach((child) => {
    if (child.type.name === "hardBreak") broken = true;
  });
  if (broken) return expanded || stack(false, 0);
  const surface = editor.view.dom;
  const line = surface.firstElementChild;

  if (!line) return false;
  if (!expanded) {
    const style = getComputedStyle(surface);

    memo.oneLineRoom =
      surface.clientWidth -
      (parseFloat(style.paddingLeft) || 0) -
      (parseFloat(style.paddingRight) || 0);
    memo.rowWidth = row.clientWidth;
  }
  // A resize while stacked moves the one-line room by as much as the row changed.
  const room = memo.oneLineRoom + (row.clientWidth - memo.rowWidth);
  const slack = expanded ? COMPOSER_FIT_SLACK_PX : 0;

  // An empty line shows the placeholder, which has to fit the one-line layout like typed text.
  if (!first.content.size) {
    const width = textWidth(line.getAttribute("data-placeholder") ?? "", line);
    const tooWide = width > 0 && room > 0 && width > room - slack;

    return tooWide ? expanded || stack(false, 0) : false;
  }
  const range = document.createRange();

  // No layout engine (tests, server render): nothing can be measured, so the line is taken to fit.
  if (typeof range.getBoundingClientRect !== "function") return expanded;
  range.selectNodeContents(line);
  const box = range.getBoundingClientRect();
  const lineHeight = parseFloat(getComputedStyle(line).lineHeight) || 24;
  const wraps = box.height >= lineHeight * 1.5;
  const length = first.textContent.length;

  if (!expanded) return wraps ? stack(true, length) : false;
  if (wraps || length >= memo.lengthAtStack) return true;

  return box.width > room - slack;
}
