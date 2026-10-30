import { findStagePlacement, stageReservedRects } from "./layout";
import { STAGE_MAX_WIDGETS, type StageState } from "./schema";

export function stageDiagramSources(text: string): string[] {
  return [...text.matchAll(/```mermaid[^\n]*\n([\s\S]*?)```/gi)]
    .map((match) => match[1].trim())
    .filter((code) => code.length > 0 && code.length <= 8000)
    .slice(0, 2);
}

/** A response caption carries prose; generated artifacts get owned, validated canvas cells. */
export function placeStageArtifacts(state: StageState, text: string, author: string): StageState {
  const widgets = [...state.widgets];

  for (const code of stageDiagramSources(text)) {
    if (widgets.some((widget) => widget.kind === "mermaid" && widget.code === code)) continue;
    if (widgets.length >= STAGE_MAX_WIDGETS) break;
    const rect = findStagePlacement(widgets, 10, 12, stageReservedRects(state));

    if (!rect) break;
    widgets.push({
      id: crypto.randomUUID(),
      kind: "mermaid",
      title: `${author} diagram`.slice(0, 100),
      code,
      rect,
    });
  }

  return widgets.length === state.widgets.length ? state : { ...state, widgets };
}

export function stageCaptionText(text: string, diagramAvailable = false): string {
  return text
    .replace(
      /```mermaid[^\n]*\n[\s\S]*?(?:```|$)/gi,
      diagramAvailable
        ? "\n\nDiagram on the stage.\n\n"
        : "\n\nDiagram source is available in Conversation; make room on the stage to place it.\n\n"
    )
    .trim();
}
