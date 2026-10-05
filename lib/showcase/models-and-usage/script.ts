/**
 * Scripted model pick for the Milky Way planning demo: a quick factual question runs on a
 * fast model, then the composer switches to a stronger one for the shoot plan. The stage
 * also shows what the picked model is, from catalog facts only — no pricing, no usage.
 */

import type { CompiledScript, ScriptFrame, ScriptSession } from "@/lib/showcase/scripted-timeline";

import { getModelContextWindowTokens } from "@/lib/chat/context-budget";
import { getSelectableChatModels, models } from "@/lib/schemas/chat-models";
import { SHOWCASE_STORY } from "@/lib/showcase/showcase-story";
import { compileScript, deriveScriptFrame } from "@/lib/showcase/scripted-timeline";

/** Non-admin picker list. No gateway fetch — `false` drops admin-only rows. */
export const showcaseSelectableModels = getSelectableChatModels(false);

/** Faster model the composer shows for the quick research question. */
export const SHOWCASE_FROM_MODEL_ID = models.google.flash.id;

/** Stronger model the selection beat lands on, for planning the shoot. */
export const SHOWCASE_TO_MODEL_ID = models.anthropic.sonnet.id;

export const MODEL_SELECT_BEAT_ID = "select";

/** Progress through the selection beat at which the composer shows the new model. */
export const MODEL_SELECTION_SWITCH_AT = 0.4;

const RESEARCH_MS = 4_000;
const SELECT_MS = 2_600;
const PLAN_MS = 3_600;

export const MODEL_DEMO_END_HOLD_MS = 1_200;

const pinnacles = SHOWCASE_STORY.sites.find((site) => site.id === SHOWCASE_STORY.choice);

if (!pinnacles) {
  throw new Error(`Showcase story has no site "${SHOWCASE_STORY.choice}"`);
}

/** Sample prompts. The stage renders them as text — nothing is submitted. */
export const MODEL_RESEARCH_PROMPT = `When is the Milky Way core visible from ${SHOWCASE_STORY.home}?`;
export const MODEL_PLAN_PROMPT = `Plan my night at ${pinnacles.name} for ${SHOWCASE_STORY.timing}: where to set up, when to shoot, and what to pack.`;

const session: ScriptSession = {
  id: "model-selection",
  endHoldMs: MODEL_DEMO_END_HOLD_MS,
  chapters: [
    {
      id: "research",
      title: "Quick question",
      caption: `A quick factual question runs on ${models.google.flash.name}.`,
      beats: [{ id: "research", durationMs: RESEARCH_MS }],
    },
    {
      id: "plan",
      title: "Big plan",
      caption: `The shoot plan is a bigger job, so the composer switches to ${models.anthropic.sonnet.name}.`,
      beats: [
        { id: MODEL_SELECT_BEAT_ID, durationMs: SELECT_MS },
        { id: "plan", durationMs: PLAN_MS },
      ],
    },
  ],
};

export const modelSelectionScript = compileScript(session);

export type ModelDerivedFrame = ScriptFrame & {
  modelId: string;
  prompt: string;
};

function modelIdForFrame(frame: ScriptFrame): string {
  if (frame.chapterIndex === 0) return SHOWCASE_FROM_MODEL_ID;
  if (frame.beatId === MODEL_SELECT_BEAT_ID && frame.beatProgress < MODEL_SELECTION_SWITCH_AT) {
    return SHOWCASE_FROM_MODEL_ID;
  }

  return SHOWCASE_TO_MODEL_ID;
}

export function deriveModelFrame(script: CompiledScript, tMs: number): ModelDerivedFrame {
  const frame = deriveScriptFrame(script, tMs);

  return {
    ...frame,
    modelId: modelIdForFrame(frame),
    prompt: frame.chapterIndex === 0 ? MODEL_RESEARCH_PROMPT : MODEL_PLAN_PROMPT,
  };
}

const PROVIDER_NAMES: Record<string, string> = {
  openai: "OpenAI",
  google: "Google",
  anthropic: "Anthropic",
  perplexity: "Perplexity",
  moonshotai: "Moonshot AI",
  deepseek: "DeepSeek",
};

export type ModelFacts = {
  provider: string;
  /** Window as the app's context budget sizes it, e.g. "1M" or "128k". */
  contextWindow: string;
  zeroDataRetention: boolean;
};

function formatWindow(tokens: number): string {
  if (tokens >= 1_000_000) return `${tokens / 1_000_000}M`;

  return `${Math.round(tokens / 1_000)}k`;
}

/** What the picker row doesn't say: who makes it, how much it can hold, and retention. */
export function modelFacts(model: { id: string; supportsZeroDataRetention?: boolean }): ModelFacts {
  const provider = model.id.split("/")[0] ?? "";

  return {
    provider: PROVIDER_NAMES[provider] ?? provider,
    contextWindow: formatWindow(getModelContextWindowTokens(model.id)),
    zeroDataRetention: model.supportsZeroDataRetention === true,
  };
}

if (!showcaseSelectableModels.some((model) => model.id === SHOWCASE_FROM_MODEL_ID)) {
  throw new Error(`Showcase model ${SHOWCASE_FROM_MODEL_ID} is not selectable`);
}

if (!showcaseSelectableModels.some((model) => model.id === SHOWCASE_TO_MODEL_ID)) {
  throw new Error(`Showcase model ${SHOWCASE_TO_MODEL_ID} is not selectable`);
}
