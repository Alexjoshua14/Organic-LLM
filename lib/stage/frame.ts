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
  const minimumReply = state.design?.status === "failed" ? 68 : 36;
  const replyPixels = Math.max(
    minimumReply,
    Math.min(
      candidates.length && !reading && (view.kind === "author" || view.kind === "piece") ? 48 : 144,
      height * 0.18,
      available - Math.min(320, height * 0.5)
    )
  );
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
  const parentHeight = Math.max(
    3,
    Math.min(
      Math.max(8, Math.ceil(parentMinimum / bodyRow)),
      centered && activeChildren ? 17 - Math.ceil(childMinimum / bodyRow) : 18
    )
  );
  const parent: StageRect = centered
    ? {
        x: 12,
        y: activeChildren ? 4 : 4 + Math.floor((18 - parentHeight) / 2),
        w: 8,
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
  const readingWork = reading || (!home && !candidates.length && author !== "organic");
  const reply: StageRect = readingWork ? { x: 8, y: 4, w: 24, h: 24 } : STAGE_RESPONSE_RECT;

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
    reading: readingWork,
    replyCompact: !readingWork && replyPixels < 96,
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
