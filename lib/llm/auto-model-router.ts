import {
  AUTO_CHAT_MODEL_ID,
  ChatModels,
  DEFAULT_CHAT_MODEL,
  type ChatModel,
  type GatewayModelId,
} from "@/lib/schemas/chat";

/** Task complexity tier for tier → gateway routing (Delphi Auto path, etc.). */
export type TaskComplexityTier = "reflex" | "reasoning";

const REASONING_KEYWORDS =
  /\b(why|how come|analyze|analyse|compare|contrast|prove|justify|implications|trade-?offs?|step by step|deep dive|reason through|elaborate|critique|evaluate)\b/i;

const REASONING_MIN_LEN = 280;

/**
 * v1 stub classifier — replace with an LLM or policy later.
 * Long drafts or reasoning-ish keywords route to the heavier tier.
 */
export function classifyTaskTier(input: string): TaskComplexityTier {
  const t = input.trim();

  if (t.length >= REASONING_MIN_LEN) return "reasoning";
  if (REASONING_KEYWORDS.test(t)) return "reasoning";

  return "reflex";
}

function firstGatewayModel(predicate: (c: ChatModel) => boolean): GatewayModelId {
  const m = ChatModels.find((c) => c.id !== AUTO_CHAT_MODEL_ID && predicate(c));
  const fallback = ChatModels.find((c) => c.id !== AUTO_CHAT_MODEL_ID);
  const row = m ?? fallback ?? DEFAULT_CHAT_MODEL;

  return row.id as GatewayModelId;
}

function firstZdrModelId(): GatewayModelId {
  return firstGatewayModel((c) => c.supportsZeroDataRetention !== false);
}

function firstAnyModelId(): GatewayModelId {
  return firstGatewayModel(() => true);
}

/** Fast, cheap gateway ids for short turns. */
const REFLEX_IDS_ZDR: GatewayModelId[] = [
  "anthropic/claude-haiku-4.5",
  "google/gemini-2.5-flash-lite",
  "openai/gpt-5.4-nano",
];

/** Heavier ids when ZDR is required. */
const REASONING_IDS_ZDR: GatewayModelId[] = [
  "anthropic/claude-sonnet-5",
  "google/gemini-3-flash",
  "openai/gpt-5.5",
];

/** When ZDR is off, non-ZDR reasoning models are allowed. */
const REASONING_IDS_ANY: GatewayModelId[] = [
  "anthropic/claude-sonnet-5",
  "perplexity/sonar-pro",
  "openai/gpt-5.5",
];

function pickFirstAllowed(ids: GatewayModelId[], zdr: boolean): GatewayModelId {
  for (const id of ids) {
    const row = ChatModels.find((c) => c.id === id);

    if (!row || row.id === AUTO_CHAT_MODEL_ID) continue;
    if (zdr && row.supportsZeroDataRetention === false) continue;

    return id;
  }

  return zdr ? firstZdrModelId() : firstAnyModelId();
}

/**
 * Maps task tier + ZDR flag to a concrete gateway model id present in {@link ChatModels}.
 */
export function tierToGatewayModelId(tier: TaskComplexityTier, zdr: boolean): GatewayModelId {
  if (tier === "reflex") {
    return pickFirstAllowed(REFLEX_IDS_ZDR, zdr);
  }

  return pickFirstAllowed(zdr ? REASONING_IDS_ZDR : REASONING_IDS_ANY, zdr);
}

export function chatModelForGatewayId(id: GatewayModelId): ChatModel {
  return ChatModels.find((c) => c.id === id) ?? DEFAULT_CHAT_MODEL;
}
