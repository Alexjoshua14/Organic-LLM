import type { StageState } from "./schema";

import { ORGANIC_STAGE_VIEW, type StageView, type StagePresentation } from "./view-schema";
import { resolveStageFrame, stageRectPixels } from "./frame";

/** UI and model use the same owner-scoped catalog, including completed work. */
export function stageViews(state: StageState) {
  const authors = new Map<string, string>();

  for (const widget of state.widgets)
    if (widget.source) authors.set(widget.source.id, widget.source.name);
  for (const message of state.messages)
    if (message.author) authors.set(message.author.id, message.author.name);
  for (const agent of state.subagents ?? []) authors.set(agent.id, agent.name);
  if (state.design && state.design.status !== "failed") authors.set(state.design.id, "Designer");

  return [
    { name: "Organic", view: ORGANIC_STAGE_VIEW },
    { name: "All pieces", view: { kind: "overview" as const, id: null } },
    ...[...authors].map(([id, name]) => ({ name, view: { kind: "author" as const, id } })),
    ...state.widgets.map((widget) => ({
      name: widget.title,
      view: { kind: "piece" as const, id: widget.id },
    })),
  ];
}

export function resolveStageView(state: StageState, view?: StageView | null): StageView | null {
  return view &&
    stageViews(state).some((entry) => entry.view.kind === view.kind && entry.view.id === view.id)
    ? view
    : null;
}

const normalize = (text: string) =>
  text.normalize("NFKC").toLocaleLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();

/** Only entire, unambiguous navigation commands bypass generation. Compound work stays with Organic. */
export function stageNavigation(message: string, state: StageState): StageView | null {
  const command = normalize(message)
    .replace(/^(?:please |can you |could you )/, "")
    .replace(/(?: please)?[.!?]*$/, "");
  const match = command.match(
    /^(?:show(?: me)?|switch(?: (?:me|us))? to|go(?: back)? to|return to|open|bring up|focus(?: on)?|let me see|take me to|i (?:want|would like) to see) (.+)$/
  );

  if (!match) return null;
  const target = match[1]
    .replace(/^the /, "")
    .replace(/(?:'s)? (?:view|tab|results?|work|pieces)$/, "");

  if (["organic", "home", "you"].includes(target)) return ORGANIC_STAGE_VIEW;
  if (["all pieces", "pieces", "workspace", "overview", "the stage"].includes(target))
    return { kind: "overview", id: null };
  const matches = stageViews(state).filter((entry) => normalize(entry.name) === target);
  const authors = matches.filter((entry) => entry.view.kind === "author");

  if (authors.length === 1) return authors[0].view;

  return matches.length === 1 ? matches[0].view : null;
}

export function stageSpaceContext(state: StageState, presentation?: StagePresentation) {
  presentation ??= state.presentation;
  const view =
    resolveStageView(state, presentation?.view ?? state.viewCommand?.target) ?? ORGANIC_STAGE_VIEW;
  const dimensions = presentation ?? { width: 1200, height: 700, composerHeight: 80 };
  const frame = resolveStageFrame(state, {
    ...dimensions,
    home: view.kind === "organic",
    author: view.kind === "author" ? view.id! : "organic",
    pieceId: view.kind === "piece" ? view.id : null,
  });

  return {
    currentView: view,
    availableViews: stageViews(state),
    viewport: presentation
      ? {
          width: presentation.width,
          height: presentation.height,
          composerHeight: presentation.composerHeight,
        }
      : null,
    visiblePieces: frame.pieces.map(({ widget, rect }) => ({
      id: widget.id,
      title: widget.title,
      rect,
      pixels: stageRectPixels(frame, rect),
    })),
    readingArea: frame.reading ? frame.reply : frame.body,
    regions: { parent: frame.parent, response: frame.reply, composer: frame.composer },
    rowHeights: frame.rows,
    navigation:
      "Cell rectangles are authoritative in every view. Rows reserve space for navigation, response and the growing composer; use rowHeights/pixel bounds to judge readability. Selecting a view only filters existing work; it never creates, delegates, or redesigns it. Organic tucks pieces away and centers the parent. Hidden pieces remain available. Only the parent/user controls selection; specialist results must not steal focus.",
  };
}
