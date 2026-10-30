import { STAGE_CONTENT_RECT, type StageRect, type StageState, type StageWidget } from "./schema";

export type StageFrameOptions = {
  width: number;
  height: number;
  composerHeight: number;
  author?: string;
  pieceId?: string | null;
  reading?: boolean;
  arranging?: boolean;
  page?: number;
  home?: boolean;
};

export function stageCellStyle(rect: StageRect) {
  return {
    gridColumn: `${rect.x + 1} / span ${rect.w}`,
    gridRow: `${rect.y + 1} / span ${rect.h}`,
  };
}

function overlaps(a: StageRect, b: StageRect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Pixel budgets become cells once, on resize or selection. No per-frame layout work. */
export function resolveStageFrame(state: StageState, options: StageFrameOptions) {
  const { width, height, composerHeight, author = "organic", reading = false } = options;
  const row = Math.max(height, 240) / 32;
  const top = Math.max(2, Math.ceil(40 / row));
  const composerRows = Math.min(15, Math.max(4, Math.ceil((composerHeight + 10) / row)));
  const composerY = 32 - composerRows;
  const visibleWidgets = options.home
    ? []
    : author === "organic"
      ? state.widgets
      : state.widgets.filter((widget) => widget.source?.id === author);
  const hasWork = visibleWidgets.length > 0;
  const focused = options.pieceId ? state.widgets.find((w) => w.id === options.pieceId) : null;
  const readingWork = reading || (!hasWork && author !== "organic");
  const activeChildren =
    state.subagents?.some((agent) => agent.status === "working" || agent.status === "canceling") ||
    (state.design && state.design.status !== "failed" && state.design.phase !== "queued");
  const rail =
    readingWork ||
    (!options.home && (hasWork || activeChildren || options.arranging || composerHeight > 140));
  const homeChildBudget =
    activeChildren && options.home
      ? Math.ceil((height < 430 ? 102 : height < 560 || composerHeight > 110 ? 204 : 270) / row) + 1
      : 0;
  const replyRows = Math.max(
    2,
    Math.min(
      Math.ceil(Math.min(144, height * 0.18) / row),
      hasWork
        ? composerY - top - 5 - Math.ceil(Math.min(260, height * 0.4) / row)
        : homeChildBudget
          ? composerY - top - 3 - homeChildBudget
          : 8
    )
  );
  const replyY = Math.max(top + 5, composerY - replyRows - 1);
  const body: StageRect = { x: 8, y: top + 1, w: 24, h: Math.max(4, replyY - top - 2) };
  const pieceNav = { ...body, h: 2 };

  if (hasWork) {
    body.y += 2;
    body.h -= 2;
  }
  const header: StageRect = { x: 0, y: 0, w: 32, h: top };
  const composer: StageRect = {
    x: width < 700 ? 0 : 4,
    y: composerY,
    w: width < 700 ? 32 : 24,
    h: composerRows,
  };
  const reply: StageRect = readingWork
    ? { x: 8, y: top + 1, w: 24, h: composerY - top - 2 }
    : { x: 4, y: replyY, w: 24, h: replyRows };
  const railHeight = (readingWork ? composerY : replyY) - top - 2;
  const tiny = height < 430 || (!!rail && railHeight * row < 220);
  const compact = height < 560 || composerHeight > 110 || (!!rail && railHeight * row < 300);
  const across = width >= 700 || tiny;
  const parentH = Math.max(
    3,
    Math.min(
      railHeight -
        (across
          ? Math.ceil((tiny ? 66 : compact ? 92 : 116) / row) + 1
          : 2 * Math.ceil((compact ? 76 : 96) / row) + 2),
      Math.max(
        Math.ceil((tiny ? 36 : compact ? 112 : 154) / row),
        Math.min(9, Math.floor(railHeight * 0.38))
      )
    )
  );
  const childH = Math.max(3, Math.floor((railHeight - parentH - 2) / 2));
  const homeChildrenH = activeChildren ? Math.ceil((tiny ? 66 : compact ? 92 : 116) / row) + 1 : 0;
  const homeParentH = Math.max(
    3,
    Math.min(9, Math.max(4, Math.floor(body.h * 0.55)), body.h - homeChildrenH)
  );
  const parent: StageRect = rail
    ? { x: 0, y: top + 1, w: 7, h: parentH }
    : {
        x: 12,
        y: top + 1 + Math.max(0, Math.floor((body.h - homeParentH - homeChildrenH) / 2)),
        w: 8,
        h: homeParentH,
      };
  const children: StageRect[] =
    rail && across
      ? [0, 1].map((slot) => ({
          x: slot * 4,
          y: parent.y + parent.h + 1,
          w: 3,
          h: railHeight - parentH - 1,
        }))
      : rail
        ? [0, 1].map((slot) => ({
            x: 0,
            y: parent.y + parent.h + 1 + slot * (childH + 1),
            w: 7,
            h: childH,
          }))
        : [0, 1].map((slot) => ({
            x: 7 + slot * 10,
            y: parent.y + parent.h + 1,
            w: 8,
            h: Math.max(3, replyY - parent.y - parent.h - 2),
          }));

  // Respect authored geometry when it is readable. Smaller windows get deliberate
  // pages of useful content, rather than a miniature, scrollable copy of the canvas.
  const project = (rect: StageRect): StageRect => ({
    x: rect.x,
    w: rect.w,
    y: body.y + Math.round(((rect.y - STAGE_CONTENT_RECT.y) / STAGE_CONTENT_RECT.h) * body.h),
    h: Math.max(
      1,
      Math.round(((rect.y + rect.h - STAGE_CONTENT_RECT.y) / STAGE_CONTENT_RECT.h) * body.h) -
        Math.round(((rect.y - STAGE_CONTENT_RECT.y) / STAGE_CONTENT_RECT.h) * body.h)
    ),
  });
  const projected = visibleWidgets.map((widget) => ({ widget, rect: project(widget.rect) }));
  const readable =
    projected.every(
      ({ widget, rect }) =>
        rect.x >= body.x &&
        rect.x + rect.w <= 32 &&
        rect.y >= body.y &&
        rect.y + rect.h <= body.y + body.h &&
        (rect.w * width) / 32 >= (widget.kind === "recipe" ? 400 : 280) &&
        rect.h * row >= (widget.kind === "recipe" ? 300 : 240)
    ) &&
    projected.every((item, i) =>
      projected.slice(i + 1).every((other) => !overlaps(item.rect, other.rect))
    );
  const ordered = visibleWidgets;
  const authoredLayout = readable && author === "organic";
  const capacity = width >= 1500 && body.h * row >= 330 ? 2 : 1;
  const pages = Math.max(1, Math.ceil(ordered.length / capacity));
  const page = Math.min(Math.max(0, options.page ?? 0), pages - 1);
  let pieces: { widget: StageWidget; rect: StageRect }[] = [];

  if (!readingWork && !options.home) {
    if (options.arranging) pieces = projected;
    else if (focused) pieces = [{ widget: focused, rect: body }];
    else if (authoredLayout) pieces = projected;
    else
      pieces = ordered
        .slice(page * capacity, (page + 1) * capacity)
        .map((widget, index, visible) => ({
          widget,
          rect:
            visible.length === 1 ? body : { x: body.x + index * 13, y: body.y, w: 11, h: body.h },
        }));
  }

  return {
    header,
    composer,
    reply,
    parent,
    children,
    pieces,
    body,
    pieceNav,
    page,
    pages: authoredLayout ? 1 : pages,
    compact,
    tiny,
    reading: readingWork,
    replyCompact: !readingWork && reply.h * row < 96,
    showPieces: !options.home,
  };
}
