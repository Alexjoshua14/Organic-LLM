import {
  STAGE_AGENT_RECT,
  STAGE_CHILD_RECTS,
  STAGE_COMPOSER_RECT,
  STAGE_CONTENT_RECT,
  STAGE_HEADER_RECT,
  STAGE_RESPONSE_RECT,
  STAGE_SIZE,
  type StageRect,
  type StageState,
} from "./schema";
import { stageViewWidgets, stageWidgetRect } from "./placements";
import type { StageView } from "./view-schema";

export type StageFrameOptions = {
  width: number;
  height: number;
  composerHeight: number;
  author?: string;
  pieceId?: string | null;
  reading?: boolean;
  home?: boolean;
  view?: StageView;
};

/**
 * Pixels the home mark needs at Speak's center size: `OrganicAgentMark hero` is
 * clamp(7rem, 24dvh, 13rem), plus its status line. Stage's height plus its own padding stands
 * in for the viewport, so this reserves a little more than the mark draws, never less.
 */
function heroPixels(height: number) {
  return Math.min(208, Math.max(112, (height + 80) * 0.24)) + 64;
}

export function stageCellStyle(rect: StageRect) {
  return {
    gridColumn: `${rect.x + 1} / span ${rect.w}`,
    gridRow: `${rect.y + 1} / span ${rect.h}`,
  };
}

/** One grid: only track sizes adapt to the viewport. Saved cell rectangles never do. */
export function resolveStageFrame(state: StageState, options: StageFrameOptions) {
  const { width, composerHeight, author = "organic", reading = false, home = false } = options;
  const view: StageView =
    options.view ??
    (options.pieceId
      ? { kind: "piece", id: options.pieceId }
      : home
        ? { kind: "organic", id: null }
        : author === "organic"
          ? { kind: "overview", id: null }
          : { kind: "author", id: author });
  const candidates = stageViewWidgets(state.widgets, view);
  const height = Math.max(240, options.height);
  const gap = Math.max(3, Math.min(8, height * 0.008));
  const headerPixels = 40;
  const composerPixels = Math.max(54, composerHeight);
  const gapRows =
    STAGE_SIZE -
    STAGE_HEADER_RECT.h -
    STAGE_CONTENT_RECT.h -
    STAGE_RESPONSE_RECT.h -
    STAGE_COMPOSER_RECT.h;
  const available = height - headerPixels - composerPixels - gap * gapRows;
  const mobile = width < 700;
  const readingWork = reading || (!home && !candidates.length && author !== "organic");
  // Organic's words sit under it on the home view, or take the body while reading. Every other
  // view gives those rows to the pieces, so the composer is the only thing below them. Saved
  // piece coordinates stay intact; only the response/content track sizes change.
  const showReply = home || readingWork;
  const replyPixels = showReply
    ? Math.max(36, Math.min(144, height * 0.18, available - Math.min(320, height * 0.5)))
    : 0;
  const contentPixels = Math.max(0, available - replyPixels);
  const inRows = (row: number, rect: StageRect) => row >= rect.y && row < rect.y + rect.h;
  const rows = Array.from({ length: STAGE_SIZE }, (_, row) =>
    inRows(row, STAGE_HEADER_RECT)
      ? headerPixels / STAGE_HEADER_RECT.h
      : inRows(row, STAGE_CONTENT_RECT)
        ? contentPixels / STAGE_CONTENT_RECT.h
        : inRows(row, STAGE_RESPONSE_RECT)
          ? replyPixels / STAGE_RESPONSE_RECT.h
          : inRows(row, STAGE_COMPOSER_RECT)
            ? composerPixels / STAGE_COMPOSER_RECT.h
            : gap
  );
  const rowOffsets = [0];

  for (const row of rows) rowOffsets.push(rowOffsets.at(-1)! + row);
  const lines = rowOffsets.slice(0, -1).flatMap((offset) => {
    const at = Number(offset.toFixed(3));

    return [
      `transparent ${at}px`,
      `var(--stage-rule) ${at}px ${at + 1}px`,
      `transparent ${at + 1}px`,
    ];
  });
  const bodyRow = contentPixels / STAGE_CONTENT_RECT.h;
  const childWidth = (width * (home ? 8 : STAGE_CHILD_RECTS[0].w)) / 32;
  const tiny = height < 430 || childWidth < 40 || bodyRow * 8 < 112;
  const compact =
    tiny || childWidth < 56 || bodyRow * 8 < 154 || height < 560 || composerHeight > 110;
  const childMinimum = tiny ? 66 : compact ? 120 : 148;
  const parentMinimum = tiny ? 36 : compact ? (width < 700 ? 126 : 112) : 154;
  const activeChildren =
    (!!state.design && state.design.status !== "failed" && state.design.phase !== "queued") ||
    state.subagents?.some((agent) => agent.status === "working" || agent.status === "canceling");
  const centered = home && !reading;
  const parentLimit = centered && activeChildren ? 17 - Math.ceil(childMinimum / bodyRow) : 18;
  // The centered mark takes Speak's center size when its rows fit (see heroPixels).
  const heroRows = Math.ceil(heroPixels(height) / bodyRow);
  const hero = centered && !compact && heroRows <= parentLimit;
  const parentHeight = Math.max(
    3,
    Math.min(Math.max(8, hero ? heroRows : Math.ceil(parentMinimum / bodyRow)), parentLimit)
  );
  const parent: StageRect = centered
    ? {
        x: mobile ? 8 : 12,
        y: activeChildren ? 4 : 4 + Math.floor((18 - parentHeight) / (mobile ? 3 : 2)),
        w: mobile ? 16 : 8,
        h: parentHeight,
      }
    : STAGE_AGENT_RECT;
  const children: readonly StageRect[] = centered
    ? [0, 1].map((slot) => ({
        x: 7 + slot * 10,
        y: parent.y + parent.h + 1,
        w: 8,
        h: Math.max(1, 22 - parent.y - parent.h - 1),
      }))
    : STAGE_CHILD_RECTS;
  const reply: StageRect = readingWork
    ? { x: 8, y: 4, w: 24, h: 24 }
    : mobile
      ? { ...STAGE_RESPONSE_RECT, x: 0, w: 32 }
      : STAGE_RESPONSE_RECT;

  return {
    width,
    height,
    rows,
    rowOffsets,
    gridTemplateRows: rows.map((row) => `${row}px`).join(" "),
    gridLines: `linear-gradient(to bottom, ${lines.join(", ")})`,
    header: STAGE_HEADER_RECT,
    composer: width < 700 ? { ...STAGE_COMPOSER_RECT, x: 0, w: 32 } : STAGE_COMPOSER_RECT,
    reply,
    parent,
    children,
    body: STAGE_CONTENT_RECT,
    // Filtering only. Inspection, selection and guide visibility cannot override placement.
    pieces:
      home || readingWork
        ? []
        : candidates.map((widget) => {
            const rect = stageWidgetRect(widget, view);

            return { widget: rect === widget.rect ? widget : { ...widget, rect }, rect };
          }),
    compact,
    tiny,
    centered,
    hero,
    reading: readingWork,
    showReply,
    showPieces: !home,
    shortChildren: !centered && bodyRow * STAGE_CHILD_RECTS[0].h < 80,
  };
}

export function stageRectPixels(
  frame: Pick<ReturnType<typeof resolveStageFrame>, "width" | "rowOffsets">,
  rect: StageRect
) {
  return {
    x: (rect.x * frame.width) / 32,
    y: frame.rowOffsets[rect.y],
    w: (rect.w * frame.width) / 32,
    h: frame.rowOffsets[rect.y + rect.h] - frame.rowOffsets[rect.y],
  };
}
