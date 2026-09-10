import {
  AUTO_CHAT_MODEL_ID,
  ChatModelCatalog,
  DEFAULT_CHAT_MODEL,
  models,
  chatModelById,
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
  const m = ChatModelCatalog.find(predicate);
  const fallback = ChatModelCatalog[0] ?? DEFAULT_CHAT_MODEL;

  return (m ?? fallback).id as GatewayModelId;
}

function firstZdrModelId(): GatewayModelId {
  return firstGatewayModel((c) => c.supportsZeroDataRetention !== false);
}

function firstAnyModelId(): GatewayModelId {
  return firstGatewayModel(() => true);
}

/** Fast, cheap gateway ids for short turns. */
export const REFLEX_IDS_ZDR: GatewayModelId[] = [
  models.google.flashLite.id as GatewayModelId,
  models.anthropic.haiku.id as GatewayModelId,
  models.openai.luna.id as GatewayModelId,
];

/** Heavier ids when ZDR is required. */
export const REASONING_IDS_ZDR: GatewayModelId[] = [
  models.anthropic.opus.id as GatewayModelId,
  models.google.flash.id as GatewayModelId,
  models.openai.sol.id as GatewayModelId,
];

/** When ZDR is off, non-ZDR reasoning models are allowed. */
export const REASONING_IDS_ANY: GatewayModelId[] = [
  models.anthropic.opus.id as GatewayModelId,
  models.perplexity.pro.id as GatewayModelId,
  models.openai.sol.id as GatewayModelId,
];

function pickFirstAllowed(ids: GatewayModelId[], zdr: boolean): GatewayModelId {
  for (const id of ids) {
    const row = chatModelById(id);

    if (!row || row.id === AUTO_CHAT_MODEL_ID) continue;
    if (zdr && row.supportsZeroDataRetention === false) continue;

    return id;
  }

  return zdr ? firstZdrModelId() : firstAnyModelId();
}

/**
 * Maps task tier + ZDR flag to a concrete gateway model id present in {@link ChatModelCatalog}.
 */
export function tierToGatewayModelId(tier: TaskComplexityTier, zdr: boolean): GatewayModelId {
  if (tier === "reflex") {
    return pickFirstAllowed(REFLEX_IDS_ZDR, zdr);
  }

  return pickFirstAllowed(zdr ? REASONING_IDS_ZDR : REASONING_IDS_ANY, zdr);
}

export function chatModelForGatewayId(id: GatewayModelId): ChatModel {
  return chatModelById(id) ?? DEFAULT_CHAT_MODEL;
}
