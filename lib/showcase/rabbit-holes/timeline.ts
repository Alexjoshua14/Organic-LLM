/**
 * Beat timeline for the rabbit-holes showcase. Stages render `deriveRabbitHoleDemoState`
 * so tests can read the path without mounting React.
 */

import type { RabbitHoleSession } from "@/lib/schemas/rabbitHoleSchemas";
import type { ScriptSession } from "@/lib/showcase/scripted-timeline";

import { BAY_NODE_ID, ROOT_NODE_ID, rabbitHoleDemoSession, rabbitHolePathSegment } from "./session";

import {
  compileScript,
  deriveScriptFrame,
  hasReachedBeat,
  type CompiledScript,
} from "@/lib/showcase/scripted-timeline";
import { SHOWCASE_STORY } from "@/lib/showcase/showcase-story";

const { science, home } = SHOWCASE_STORY;

export const RABBIT_HOLES_SCRIPT: ScriptSession = {
  id: "showcase-rabbit-holes",
  endHoldMs: 1200,
  chapters: [
    {
      id: "topic",
      title: "Topic",
      caption: `You ask what the Milky Way's core is — ${science.coreDistance}.`,
      beats: [{ id: "topic", durationMs: 2200 }],
    },
    {
      id: "summary",
      title: "Summary",
      caption: `From ${home}, the summary and key points cover the core's distance, the season, a new moon, and skyglow. Related questions sit beside the article.`,
      beats: [{ id: "summary", durationMs: 5400 }],
    },
    {
      id: "branch",
      title: "Branch",
      caption:
        "The path adds a branch: when the core is visible from the Bay Area, and why a new moon matters.",
      beats: [{ id: "branch", durationMs: 2400 }],
    },
  ],
};

export const rabbitHolesCompiledScript: CompiledScript = compileScript(RABBIT_HOLES_SCRIPT);

export type RabbitHoleDemoPhase = "topic" | "summary" | "branch";

export type RabbitHoleDemoState = {
  phase: RabbitHoleDemoPhase;
  beatId: string;
  chapterIndex: number;
  activeNodeId: string;
  pathNodeIds: readonly string[];
  showSummary: boolean;
  showBranchSuggestions: boolean;
  session: RabbitHoleSession;
};

function phaseForChapter(chapterId: string): RabbitHoleDemoPhase {
  if (chapterId === "branch") return "branch";
  if (chapterId === "summary") return "summary";

  return "topic";
}

export function deriveRabbitHoleDemoState(tMs: number): RabbitHoleDemoState {
  const frame = deriveScriptFrame(rabbitHolesCompiledScript, tMs);
  const showSummary = hasReachedBeat(rabbitHolesCompiledScript, frame.tMs, "summary");
  const showBranchSuggestions = showSummary;
  const branched = hasReachedBeat(rabbitHolesCompiledScript, frame.tMs, "branch");
  const activeNodeId = branched ? BAY_NODE_ID : ROOT_NODE_ID;
  const path = branched
    ? [rabbitHolePathSegment(ROOT_NODE_ID), rabbitHolePathSegment(BAY_NODE_ID)]
    : [rabbitHolePathSegment(ROOT_NODE_ID)];
  const chapter = rabbitHolesCompiledScript.chapters[frame.chapterIndex]!;

  return {
    phase: phaseForChapter(chapter.id),
    beatId: frame.beatId,
    chapterIndex: frame.chapterIndex,
    activeNodeId,
    pathNodeIds: path.map((segment) => segment.nodeId),
    showSummary,
    showBranchSuggestions,
    session: {
      ...rabbitHoleDemoSession,
      path,
      activeNodeId,
    },
  };
}

/** Path and active node after the visitor picks something the script has not reached. */
export function rabbitHoleDemoSessionFor(
  scripted: RabbitHoleDemoState,
  activeNodeId: string
): RabbitHoleSession {
  if (activeNodeId === scripted.activeNodeId) return scripted.session;

  if (activeNodeId === ROOT_NODE_ID) {
    return { ...scripted.session, activeNodeId: ROOT_NODE_ID };
  }

  return {
    ...scripted.session,
    activeNodeId,
    path: [rabbitHolePathSegment(ROOT_NODE_ID), rabbitHolePathSegment(activeNodeId)],
  };
}
