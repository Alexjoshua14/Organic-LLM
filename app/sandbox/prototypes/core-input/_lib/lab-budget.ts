import {
  finalizeContextBudget,
  type ContextBudgetEstimate,
  type ContextBudgetSegment,
  type ContextBudgetSegmentId,
} from "@/lib/chat/context-budget";

type SegmentMix = {
  id: Exclude<ContextBudgetSegmentId, "free">;
  label: string;
  /** Share of the used window; renormalised over whichever segments are active. */
  share: number;
  color: string;
};

/** Proportions of a typical mid-thread Arcadia pack. Labels and colors match production. */
const SEGMENT_MIX: SegmentMix[] = [
  { id: "system", label: "System prompt", share: 0.16, color: "hsl(199 89% 48% / 0.82)" },
  { id: "tools", label: "Tools & instructions", share: 0.07, color: "hsl(24 95% 53% / 0.82)" },
  { id: "memory", label: "Memory layer", share: 0.06, color: "hsl(280 75% 55% / 0.78)" },
  { id: "summary", label: "Rolling summary", share: 0.05, color: "hsl(262 83% 58% / 0.78)" },
  { id: "messages", label: "Thread messages", share: 0.5, color: "hsl(38 92% 50% / 0.88)" },
  { id: "tool_output", label: "Tool outputs", share: 0.12, color: "hsl(32 88% 48% / 0.86)" },
  { id: "draft", label: "Your draft", share: 0.04, color: "hsl(152 68% 42% / 0.9)" },
];

/** Thread length implied by the fill, so coverage and headroom rows read sensibly. */
const MAX_FIXTURE_THREAD_MESSAGES = 64;
const FIXTURE_CONTEXT_MESSAGE_LIMIT = 10;

export type LabBudgetParams = {
  modelId: string;
  /** 0–1 share of the model's input budget to report as used. */
  fillRatio: number;
  memoryEnabled?: boolean;
  webSearchEnabled?: boolean;
};

/**
 * Deterministic `ContextBudgetEstimate` for the lab: same window math as production
 * (`finalizeContextBudget`), with segment tokens scaled to hit `fillRatio` exactly.
 */
export function makeLabBudget({
  modelId,
  fillRatio,
  memoryEnabled = true,
  webSearchEnabled = true,
}: LabBudgetParams): ContextBudgetEstimate {
  const fill = Math.min(1, Math.max(0, fillRatio));

  // An empty pass yields the model's input budget without re-deriving the reserve here.
  const { inputBudgetTokens } = finalizeContextBudget({
    modelId,
    segments: [],
    contextMessageLimit: FIXTURE_CONTEXT_MESSAGE_LIMIT,
    packedMessageCount: 0,
    totalThreadMessages: 0,
    includesRollingSummary: false,
  });

  const usedTokens = Math.round(inputBudgetTokens * fill);
  const totalThreadMessages = Math.round(fill * MAX_FIXTURE_THREAD_MESSAGES);
  const includesRollingSummary = totalThreadMessages > FIXTURE_CONTEXT_MESSAGE_LIMIT;

  const activeMix = SEGMENT_MIX.filter(
    (row) =>
      (row.id !== "memory" || memoryEnabled) && (row.id !== "summary" || includesRollingSummary)
  );
  const totalShare = activeMix.reduce((sum, row) => sum + row.share, 0);

  const segments: ContextBudgetSegment[] = activeMix.map((row) => ({
    id: row.id,
    label: row.label,
    tokens: Math.round((usedTokens * row.share) / totalShare),
    color: row.color,
  }));

  const memoryTokens = segments.find((segment) => segment.id === "memory")?.tokens ?? 0;
  const memoriesInjected = memoryEnabled ? Math.round(4 + fill * 16) : 0;

  const activeToolNames = [
    webSearchEnabled ? "web_search" : null,
    memoryEnabled ? "search_memories" : null,
    "get_more_chat_history",
  ].filter((name): name is string => name != null);

  return finalizeContextBudget({
    modelId,
    segments,
    contextMessageLimit: FIXTURE_CONTEXT_MESSAGE_LIMIT,
    packedMessageCount: Math.min(FIXTURE_CONTEXT_MESSAGE_LIMIT, totalThreadMessages),
    totalThreadMessages,
    includesRollingSummary,
    activeToolNames,
    memoriesInjected,
    lastTurn:
      fill > 0
        ? {
            inputTokens: Math.round(usedTokens * 0.93),
            memoryTokens,
            memoriesInjected,
          }
        : undefined,
    source: "client",
  });
}

/** Fills that walk the ring through its kelvin ramp (warm headroom → blue-white stress). */
export const LAB_BUDGET_FILL_RAMP = [0.05, 0.25, 0.5, 0.75, 0.9, 1] as const;
