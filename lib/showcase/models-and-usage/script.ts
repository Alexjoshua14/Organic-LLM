/**
 * Scripted model pick for the Milky Way planning demo.
 * The composer starts on a faster research model and switches to a stronger one
 * for the shoot plan. Usage stays hidden until the second chapter.
 */

import type { CompiledScript, ScriptFrame, ScriptSession } from "@/lib/showcase/scripted-timeline";

import { getSelectableChatModels, models } from "@/lib/schemas/chat-models";
import { SHOWCASE_STORY } from "@/lib/showcase/showcase-story";
import { compileScript, deriveScriptFrame } from "@/lib/showcase/scripted-timeline";

/** Non-admin picker list. No gateway fetch — `false` drops admin-only rows. */
export const showcaseSelectableModels = getSelectableChatModels(false);

/** Faster model the composer shows while the research notes are on screen. */
export const SHOWCASE_FROM_MODEL_ID = models.google.flash.id;

/** Stronger model the selection beat lands on, for planning the shoot. */
export const SHOWCASE_TO_MODEL_ID = models.anthropic.sonnet.id;

export const MODELS_USAGE_SELECT_BEAT_ID = "select";

/** Progress through the selection beat at which the composer shows the new model. */
export const MODELS_USAGE_SELECTION_SWITCH_AT = 0.4;

const COMPOSE_MS = 4_000;
const SELECT_MS = 2_500;
const USAGE_MS = 3_500;

export const MODELS_USAGE_END_HOLD_MS = 1_200;

const pinnacles = SHOWCASE_STORY.sites.find((site) => site.id === SHOWCASE_STORY.choice);

if (!pinnacles) {
  throw new Error(`Showcase story has no site "${SHOWCASE_STORY.choice}"`);
}

/** Sample prompt. The stage renders it as text — nothing is submitted. */
export const MODELS_USAGE_PROMPT = `When is the Milky Way core visible from ${SHOWCASE_STORY.home}, and what should I pack for ${SHOWCASE_STORY.timing} at ${pinnacles.name}?`;

const session: ScriptSession = {
  id: "models-and-usage",
  endHoldMs: MODELS_USAGE_END_HOLD_MS,
  chapters: [
    {
      id: "model",
      title: "Model",
      caption: `The composer starts on ${models.google.flash.name} for the research notes, then switches to ${models.anthropic.sonnet.name} to plan the shoot.`,
      beats: [
        { id: "compose", durationMs: COMPOSE_MS },
        { id: MODELS_USAGE_SELECT_BEAT_ID, durationMs: SELECT_MS },
      ],
    },
    {
      id: "usage",
      title: "Usage",
      caption:
        "Token totals, estimated cost, and a per-model split for that fictional stretch — research, the plan, and a voice question. Thirty days is the default range.",
      beats: [{ id: "usage", durationMs: USAGE_MS }],
    },
  ],
};

export const modelsUsageScript = compileScript(session);

export type ModelsUsageDerivedFrame = ScriptFrame & {
  modelId: string;
  /** True once the usage chapter is the active chapter. */
  showUsage: boolean;
};

function modelIdForFrame(frame: ScriptFrame): string {
  if (frame.chapterIndex > 0) return SHOWCASE_TO_MODEL_ID;
  if (
    frame.beatId === MODELS_USAGE_SELECT_BEAT_ID &&
    frame.beatProgress >= MODELS_USAGE_SELECTION_SWITCH_AT
  ) {
    return SHOWCASE_TO_MODEL_ID;
  }

  return SHOWCASE_FROM_MODEL_ID;
}

export function deriveModelsUsageFrame(
  script: CompiledScript,
  tMs: number
): ModelsUsageDerivedFrame {
  const frame = deriveScriptFrame(script, tMs);

  return {
    ...frame,
    modelId: modelIdForFrame(frame),
    showUsage: frame.chapterIndex >= 1,
  };
}

if (!showcaseSelectableModels.some((model) => model.id === SHOWCASE_FROM_MODEL_ID)) {
  throw new Error(`Showcase model ${SHOWCASE_FROM_MODEL_ID} is not selectable`);
}

if (!showcaseSelectableModels.some((model) => model.id === SHOWCASE_TO_MODEL_ID)) {
  throw new Error(`Showcase model ${SHOWCASE_TO_MODEL_ID} is not selectable`);
}
