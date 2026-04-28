import type { IngestModelTier } from "./types";

import {
  ChatModels,
  DEFAULT_CHAT_MODEL,
  type ChatModel,
  type GatewayModelId,
} from "@/lib/schemas/chat";

const REASONING_KEYWORDS =
  /\b(why|how come|analyze|analyse|compare|contrast|prove|justify|implications|trade-?offs?|step by step|deep dive|reason through|elaborate|critique|evaluate)\b/i;

const REASONING_MIN_LEN = 280;

/**
 * v1 stub classifier — replace with an LLM or policy later.
 * Long drafts or reasoning-ish keywords route to the heavier tier.
 */
export function classifyIngestTier(input: string): IngestModelTier {
  const t = input.trim();

  if (t.length >= REASONING_MIN_LEN) return "reasoning";
  if (REASONING_KEYWORDS.test(t)) return "reasoning";

  return "reflex";
}

function firstZdrModelId(): GatewayModelId {
  const m = ChatModels.find((c) => c.supportsZeroDataRetention !== false);

  return (m ?? ChatModels[0]).id;
}

function firstAnyModelId(): GatewayModelId {
  return ChatModels[0].id;
}

/** Fast, cheap gateway ids for short ingest turns. */
const REFLEX_IDS_ZDR: GatewayModelId[] = [
  "openai/gpt-5.4-nano",
  "google/gemini-2.5-flash-lite",
  "anthropic/claude-haiku-4.5",
];

/** Heavier ids when ZDR is required. */
const REASONING_IDS_ZDR: GatewayModelId[] = [
  "openai/gpt-5.4",
  "anthropic/claude-sonnet-4.6",
  "google/gemini-3-flash",
];

/** When ZDR is off, non-ZDR reasoning models are allowed. */
const REASONING_IDS_ANY: GatewayModelId[] = [
  "perplexity/sonar-reasoning",
  "openai/gpt-5.4",
  "anthropic/claude-sonnet-4.6",
];

function pickFirstAllowed(ids: GatewayModelId[], zdr: boolean): GatewayModelId {
  for (const id of ids) {
    const row = ChatModels.find((c) => c.id === id);

    if (!row) continue;
    if (zdr && row.supportsZeroDataRetention === false) continue;

    return id;
  }

  return zdr ? firstZdrModelId() : firstAnyModelId();
}

/**
 * Maps ingest tier + ZDR flag to a concrete gateway model id present in {@link ChatModels}.
 */
export function tierToGatewayModelId(tier: IngestModelTier, zdr: boolean): GatewayModelId {
  if (tier === "reflex") {
    return pickFirstAllowed(REFLEX_IDS_ZDR, zdr);
  }

  return pickFirstAllowed(zdr ? REASONING_IDS_ZDR : REASONING_IDS_ANY, zdr);
}

export function chatModelForGatewayId(id: GatewayModelId): ChatModel {
  return ChatModels.find((c) => c.id === id) ?? DEFAULT_CHAT_MODEL;
}
