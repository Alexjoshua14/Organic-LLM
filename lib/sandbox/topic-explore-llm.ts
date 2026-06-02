import "server-only";

import { KNOWLEDGE_GATEWAY_PROVIDER_OPTIONS } from "@/lib/knowledge/gateway-options";

/** Starters + digest (single structured call). */
export const TOPIC_EXPLORE_STARTERS_MODEL = "openai/gpt-5.4-mini" as const;

/** Session thought-profile merge. */
export const TOPIC_EXPLORE_THOUGHT_MODEL = "openai/gpt-5.4-mini" as const;

/** Steer panel (guidance for assist, not chat). */
export const TOPIC_EXPLORE_STEER_MODEL = "openai/gpt-5.4-mini" as const;

/** Suggested next user message (composer fill). */
export const TOPIC_EXPLORE_ASSIST_MODEL = "anthropic/claude-sonnet-4.6" as const;

export const TOPIC_EXPLORE_PROVIDER_OPTIONS = KNOWLEDGE_GATEWAY_PROVIDER_OPTIONS;

/**
 * Best-effort JSON parse for model output that may include markdown fences.
 */
export function parseJsonObjectFromLlmText(raw: string): Record<string, unknown> | null {
  let t = raw.trim();
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/i.exec(t);

  if (fence) {
    t = fence[1]!.trim();
  }

  try {
    const v = JSON.parse(t) as unknown;

    return v !== null && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
