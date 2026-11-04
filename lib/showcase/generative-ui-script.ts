/**
 * Beat timeline for the Generative UI showcase: three requests, each typed, answered, then
 * rendered as a structured block. Stages render `deriveGenUiDemo` so the order is testable
 * without mounting React.
 */

import {
  compileScript,
  deriveScriptFrame,
  hasReachedBeat,
  type ScriptSession,
} from "./scripted-timeline";

export type GenUiViewId = "compare" | "plan" | "kit";

export const GEN_UI_VIEW_IDS: readonly GenUiViewId[] = ["compare", "plan", "kit"];

const ASK_MS = 1600;
const ANSWER_MS = 1000;
const BUILD_MS = 1500;
/** Time on the finished block before the next request starts, long enough to read it. */
const READ_MS = 3600;
/** Share of the build beat spent on the skeleton; the block holds for the rest. */
const SKELETON_SHARE = 0.55;

export const GEN_UI_SCRIPT: ScriptSession = {
  id: "showcase-generative-ui",
  endHoldMs: 1200,
  chapters: [
    {
      id: "compare",
      title: "Compare",
      caption: "You ask for a place. The answer is a decision matrix you can inspect.",
      beats: [
        { id: "compare-ask", durationMs: ASK_MS },
        { id: "compare-answer", durationMs: ANSWER_MS },
        { id: "compare-build", durationMs: BUILD_MS },
        { id: "compare-read", durationMs: READ_MS },
      ],
    },
    {
      id: "plan",
      title: "Plan",
      caption: "Then a plan for the night, as a timeline you can open step by step.",
      beats: [
        { id: "plan-ask", durationMs: ASK_MS },
        { id: "plan-answer", durationMs: ANSWER_MS },
        { id: "plan-build", durationMs: BUILD_MS },
        { id: "plan-read", durationMs: READ_MS },
      ],
    },
    {
      id: "kit",
      title: "Pack",
      caption: "And a kit list you can check off, with the cold remembered.",
      beats: [
        { id: "kit-ask", durationMs: ASK_MS },
        { id: "kit-answer", durationMs: ANSWER_MS },
        { id: "kit-build", durationMs: BUILD_MS },
        { id: "kit-read", durationMs: READ_MS },
      ],
    },
  ],
};

export const genUiCompiledScript = compileScript(GEN_UI_SCRIPT);

export type GenUiDemoFrame = {
  view: GenUiViewId;
  chapterIndex: number;
  /** 0 → 1 while the request is typed into the thread. */
  askProgress: number;
  showReply: boolean;
  /** "building" shows the loading skeleton, "ready" the production block. */
  block: "hidden" | "building" | "ready";
};

export function deriveGenUiDemo(tMs: number): GenUiDemoFrame {
  const frame = deriveScriptFrame(genUiCompiledScript, tMs);
  const view = GEN_UI_VIEW_IDS[frame.chapterIndex]!;
  const askBeat = genUiCompiledScript.beats.find((b) => b.id === `${view}-ask`)!;
  const buildBeat = genUiCompiledScript.beats.find((b) => b.id === `${view}-build`)!;
  const askProgress = Math.max(
    0,
    Math.min(1, (frame.tMs - askBeat.startMs) / (askBeat.endMs - askBeat.startMs))
  );
  const reached = (id: string) => hasReachedBeat(genUiCompiledScript, frame.tMs, id);

  return {
    view,
    chapterIndex: frame.chapterIndex,
    askProgress,
    showReply: reached(`${view}-answer`),
    block: !reached(`${view}-build`)
      ? "hidden"
      : frame.tMs >= buildBeat.startMs + BUILD_MS * SKELETON_SHARE
        ? "ready"
        : "building",
  };
}
