/**
 * Synthetic context budget for the context-controls showcase.
 * Effort changes only the memory segment (and which story memories are in view).
 * Nothing here reads settings, memory stores, or the network.
 */

import {
  ESTIMATED_BASE_TOOL_TOKENS,
  ESTIMATED_MEMORY_TOOL_TOKENS,
  ESTIMATED_SYSTEM_PROMPT_TOKENS,
  finalizeContextBudget,
  type ContextBudgetEstimate,
  type ContextBudgetSegment,
} from "@/lib/chat/context-budget";
import {
  CONTEXT_EFFORT_BUDGETS,
  estimatedMemoryContextTokensForEffort,
  type ContextEffortLevel,
} from "@/lib/memory/context-effort";
import {
  compileScript,
  deriveScriptFrame,
  type ScriptSession,
} from "@/lib/showcase/scripted-timeline";
import { SHOWCASE_STORY } from "@/lib/showcase/showcase-story";

/**
 * Smallest selectable catalog window (`getModelContextWindowTokens`). A million-token
 * model would swallow the Quick → Heavy memory delta on the donut.
 */
export const CONTEXT_DEMO_MODEL_ID = "perplexity/sonar-reasoning-pro";

/** How many of `SHOWCASE_STORY.memories` each effort level puts in the window. */
const MEMORY_COUNT: Record<ContextEffortLevel, number> = {
  instant: 1,
  quick: 2,
  heavy: SHOWCASE_STORY.memories.length,
};

/**
 * Fixed stand-in for a short trip thread. Not measured — the demo must not tokenize
 * a live conversation. Large enough to read as "thread" in the legend, small enough
 * that the memory row is what moves.
 */
const DEMO_THREAD_TOKENS = 1_920;

/** Memory is on; web search is off so the tools row stays put while memory grows. */
const DEMO_TOOL_TOKENS = ESTIMATED_BASE_TOOL_TOKENS + ESTIMATED_MEMORY_TOOL_TOKENS;

const DEMO_TOOL_NAMES = ["search_memories"] as const;

/**
 * Share of the Heavy beat spent leaving Quick and arriving at Heavy.
 * Settled chapter time is ~0.999, which is past the end of the ramp, so reduced-motion
 * stepping shows the finished Heavy budget rather than the midpoint.
 */
const HEAVY_RAMP_START = 0.12;
const HEAVY_RAMP_END = 0.88;

export const CONTEXT_CONTROLS_SESSION: ScriptSession = {
  id: "context-controls",
  endHoldMs: 1_200,
  chapters: [
    {
      id: "inspect",
      title: "Inspect",
      caption:
        "The inspector is open: system prompt, this thread, tools, and memory, at the Quick budget.",
      beats: [{ id: "quick", durationMs: 5_000 }],
    },
    {
      id: "effort",
      title: "Effort",
      caption:
        "Effort moves from Quick toward Heavy. Retrieval may wait longer, search wider, and carry more memory into the answer.",
      beats: [{ id: "heavy", durationMs: 5_000 }],
    },
  ],
};

/** Compiled once. The stage clock and `deriveContextDemo` both read this object. */
export const contextControlsScript = compileScript(CONTEXT_CONTROLS_SESSION);

export type ContextDemoView = {
  tMs: number;
  chapterIndex: number;
  beatId: string;
  /** Effort the active beat stands for, even while the Heavy beat is still leaving Quick. */
  beatEffort: ContextEffortLevel;
  /** Effort the slider and budget should show. */
  effort: ContextEffortLevel;
  budget: ContextBudgetEstimate;
  memories: readonly string[];
  caption: string;
  chapterTitle: string;
  complete: boolean;
};

export function contextDemoBeatEffort(beatId: string): ContextEffortLevel {
  if (beatId === "instant" || beatId === "quick" || beatId === "heavy") return beatId;

  throw new Error(`Context demo beat "${beatId}" does not map to a context effort level`);
}

function formatWait(ms: number): string {
  return ms < 1_000 ? `${ms} ms` : `${ms / 1_000} s`;
}

export type ContextEffortFacts = {
  /** Hard wall-clock for retrieval; anything later is dropped. */
  waitMs: number;
  waitLabel: string;
  search: string;
  keeps: string;
  profile: string;
};

/**
 * What an effort level changes besides tokens, read from the production budget table
 * (`lib/memory/context-effort.ts`) so the demo cannot drift from the real limits.
 */
export function contextEffortFacts(level: ContextEffortLevel): ContextEffortFacts {
  const b = CONTEXT_EFFORT_BUDGETS[level];
  const planning =
    b.plannerTimeoutMs === null
      ? "Searches your message directly"
      : `Plans its queries first (up to ${formatWait(b.plannerTimeoutMs)})`;

  return {
    waitMs: b.budgetMs,
    waitLabel: `up to ${formatWait(b.budgetMs)}`,
    search: b.secondPassMinRemainingMs > 0 ? `${planning}, then a second pass` : planning,
    keeps: `Pulls ${b.overfetch} candidates, keeps the best ${b.injectCap}`,
    profile: b.includeProfile
      ? `Profile: ${b.profileMaxSections} section${b.profileMaxSections === 1 ? "" : "s"}${b.profileRich ? ", in depth" : ""}`
      : "No profile summary",
  };
}

export function contextDemoMemories(effort: ContextEffortLevel): readonly string[] {
  return SHOWCASE_STORY.memories.slice(0, MEMORY_COUNT[effort]);
}

function demoSegments(memoryTokens: number): ContextBudgetSegment[] {
  return [
    {
      id: "system",
      label: "System prompt",
      tokens: ESTIMATED_SYSTEM_PROMPT_TOKENS,
      color: "hsl(199 89% 48% / 0.82)",
    },
    {
      id: "messages",
      label: "Thread messages",
      tokens: DEMO_THREAD_TOKENS,
      color: "hsl(38 92% 50% / 0.88)",
    },
    {
      id: "tools",
      label: "Tools & instructions",
      tokens: DEMO_TOOL_TOKENS,
      color: "hsl(24 95% 53% / 0.82)",
    },
    {
      id: "memory",
      label: "Memory layer",
      tokens: memoryTokens,
      color: "hsl(280 75% 55% / 0.78)",
    },
  ];
}

function budgetFor(memoryTokens: number, memories: readonly string[]): ContextBudgetEstimate {
  return finalizeContextBudget({
    modelId: CONTEXT_DEMO_MODEL_ID,
    segments: demoSegments(memoryTokens),
    contextMessageLimit: 10,
    packedMessageCount: 4,
    totalThreadMessages: 4,
    includesRollingSummary: false,
    activeToolNames: [...DEMO_TOOL_NAMES],
    memoriesInjected: memories.length,
    source: "client",
  });
}

/** Settled budget for one effort level. Memory tokens are that level's combined cap. */
export function contextDemoBudget(effort: ContextEffortLevel): ContextBudgetEstimate {
  return budgetFor(estimatedMemoryContextTokensForEffort(effort), contextDemoMemories(effort));
}

function heavyRampT(beatProgress: number): number {
  if (beatProgress <= HEAVY_RAMP_START) return 0;
  if (beatProgress >= HEAVY_RAMP_END) return 1;

  const p = (beatProgress - HEAVY_RAMP_START) / (HEAVY_RAMP_END - HEAVY_RAMP_START);

  return 1 - (1 - p) ** 2;
}

function viewForEffort(
  effort: ContextEffortLevel,
  frame: ReturnType<typeof deriveScriptFrame>
): ContextDemoView {
  const chapter = contextControlsScript.chapters[frame.chapterIndex]!;

  return {
    tMs: frame.tMs,
    chapterIndex: frame.chapterIndex,
    beatId: frame.beatId,
    beatEffort: contextDemoBeatEffort(frame.beatId),
    effort,
    budget: contextDemoBudget(effort),
    memories: contextDemoMemories(effort),
    caption: chapter.caption,
    chapterTitle: chapter.title,
    complete: frame.complete,
  };
}

/**
 * Script frame → what the stage shows.
 * Inspect holds Quick. The Effort chapter eases memory tokens from Quick's cap to Heavy's
 * so the legend count and donut climb instead of cutting.
 */
export function deriveContextDemo(tMs: number): ContextDemoView {
  const frame = deriveScriptFrame(contextControlsScript, tMs);
  const beatEffort = contextDemoBeatEffort(frame.beatId);

  if (beatEffort !== "heavy") return viewForEffort(beatEffort, frame);

  const t = heavyRampT(frame.beatProgress);

  if (t <= 0) return viewForEffort("quick", frame);
  if (t >= 1) return viewForEffort("heavy", frame);

  const from = estimatedMemoryContextTokensForEffort("quick");
  const to = estimatedMemoryContextTokensForEffort("heavy");
  const memoryTokens = Math.round(from + (to - from) * t);
  const memories = SHOWCASE_STORY.memories.slice(0, t < 0.45 ? 3 : 4);
  const chapter = contextControlsScript.chapters[frame.chapterIndex]!;

  return {
    tMs: frame.tMs,
    chapterIndex: frame.chapterIndex,
    beatId: frame.beatId,
    beatEffort,
    effort: "heavy",
    budget: budgetFor(memoryTokens, memories),
    memories,
    caption: chapter.caption,
    chapterTitle: chapter.title,
    complete: frame.complete,
  };
}
