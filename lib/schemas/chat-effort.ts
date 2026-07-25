import type { AnthropicProviderOptions } from "@ai-sdk/anthropic";
import type { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import type { OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import type { JSONValue } from "@ai-sdk/provider";

import z from "zod";

import { AUTO_CHAT_MODEL_ID, AUTO_RESOLVED_SONNET_MODEL_ID } from "@/lib/schemas/chat-model-ids";

/**
 * Unified composer effort dial. Not every provider/model accepts every value —
 * see `getEffortLevelsForModel` / `buildEffortProviderOptions`.
 *
 * Sources:
 * - OpenAI reasoning.effort (model-dependent: none|minimal|low|medium|high|xhigh|max)
 * - Anthropic adaptive thinking + output effort (low|medium|high|xhigh|max) or budget_tokens
 * - Google thinkingLevel (minimal|low|medium|high) / thinkingBudget (Gemini 2.5)
 */
export const CHAT_EFFORT_LEVELS = [
  { id: "auto", name: "Auto" },
  { id: "none", name: "None" },
  { id: "minimal", name: "Minimal" },
  { id: "low", name: "Low" },
  { id: "medium", name: "Medium" },
  { id: "high", name: "High" },
  { id: "xhigh", name: "Extra high" },
  { id: "max", name: "Max" },
] as const;

export type ChatEffortLevel = (typeof CHAT_EFFORT_LEVELS)[number]["id"];

export type ChatEffortLevelRow = (typeof CHAT_EFFORT_LEVELS)[number];

export const ChatEffortLevelSchema = z.enum([
  "auto",
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]);

export const DEFAULT_CHAT_EFFORT: ChatEffortLevel = "auto";

const EFFORT_RANK: Record<ChatEffortLevel, number> = {
  auto: -1,
  none: 0,
  minimal: 1,
  low: 2,
  medium: 3,
  high: 4,
  xhigh: 5,
  max: 6,
};

const LEVEL_BY_ID = Object.fromEntries(
  CHAT_EFFORT_LEVELS.map((row) => [row.id, row])
) as Record<ChatEffortLevel, ChatEffortLevelRow>;

/** Non-auto levels a model can actually send to its provider. */
export type EffortCapability = {
  /** When false, only Auto is shown; provider options are omitted. */
  configurable: boolean;
  levels: Exclude<ChatEffortLevel, "auto">[];
};

const OPENAI_GPT56: EffortCapability = {
  configurable: true,
  levels: ["none", "low", "medium", "high", "xhigh", "max"],
};

const OPENAI_GPT55: EffortCapability = {
  configurable: true,
  levels: ["none", "low", "medium", "high", "xhigh"],
};

const OPENAI_GPT55_PRO: EffortCapability = {
  configurable: true,
  levels: ["medium", "high", "xhigh"],
};

const OPENAI_GPT54_FAMILY: EffortCapability = {
  configurable: true,
  levels: ["none", "low", "medium", "high", "xhigh"],
};

/** Claude Fable / Opus 4.8 / Sonnet 5 — adaptive thinking + effort. */
const ANTHROPIC_ADAPTIVE_FULL: EffortCapability = {
  configurable: true,
  levels: ["none", "low", "medium", "high", "xhigh", "max"],
};

/** Models that support adaptive effort but not `xhigh`. */
const ANTHROPIC_ADAPTIVE_NO_XHIGH: EffortCapability = {
  configurable: true,
  levels: ["none", "low", "medium", "high", "max"],
};

/** Haiku-class: manual `budget_tokens` only (no output_config.effort). */
const ANTHROPIC_BUDGET: EffortCapability = {
  configurable: true,
  levels: ["none", "minimal", "low", "medium", "high", "xhigh", "max"],
};

const GOOGLE_FLASH_LEVELS: EffortCapability = {
  configurable: true,
  levels: ["minimal", "low", "medium", "high"],
};

const GOOGLE_PRO_LEVELS: EffortCapability = {
  configurable: true,
  levels: ["low", "medium", "high"],
};

/** Gemini 2.5 Flash — budget; thinking can be disabled (0). */
const GOOGLE_25_FLASH_BUDGET: EffortCapability = {
  configurable: true,
  levels: ["none", "minimal", "low", "medium", "high", "xhigh", "max"],
};

/** Gemini 2.5 Pro — thinking cannot be disabled. */
const GOOGLE_25_PRO_BUDGET: EffortCapability = {
  configurable: true,
  levels: ["minimal", "low", "medium", "high", "xhigh", "max"],
};

const NO_EFFORT: EffortCapability = { configurable: false, levels: [] };

const ANTHROPIC_BUDGET_TOKENS: Record<Exclude<ChatEffortLevel, "auto" | "none">, number> = {
  minimal: 1024,
  low: 4096,
  medium: 10000,
  high: 20000,
  xhigh: 32000,
  max: 32000,
};

const GOOGLE_25_BUDGET_TOKENS: Record<Exclude<ChatEffortLevel, "auto" | "none">, number> = {
  minimal: 512,
  low: 1024,
  medium: 8192,
  high: 16384,
  xhigh: 24576,
  max: 24576,
};

function stripProviderPrefix(modelId: string): string {
  const slash = modelId.indexOf("/");

  return slash >= 0 ? modelId.slice(slash + 1) : modelId;
}

function providerOf(modelId: string): string {
  const slash = modelId.indexOf("/");

  return slash >= 0 ? modelId.slice(0, slash) : "";
}

/**
 * Resolve effort capability for a gateway model id (`provider/model`).
 * Auto uses the same capability as its resolved Sonnet target for UI parity.
 */
export function getEffortCapabilityForModel(modelId: string): EffortCapability {
  if (modelId === AUTO_CHAT_MODEL_ID) {
    return getEffortCapabilityForModel(AUTO_RESOLVED_SONNET_MODEL_ID);
  }

  const provider = providerOf(modelId);
  const slug = stripProviderPrefix(modelId).toLowerCase();

  if (provider === "openai") {
    if (slug.includes("gpt-5.6")) return OPENAI_GPT56;
    if (slug.includes("gpt-5.5-pro") || /gpt-5\.5.*-pro/.test(slug)) return OPENAI_GPT55_PRO;
    if (slug.includes("gpt-5.5")) return OPENAI_GPT55;
    if (slug.includes("gpt-5.4") || slug.includes("gpt-5.3") || slug.includes("gpt-5.2")) {
      return OPENAI_GPT54_FAMILY;
    }
    if (slug.includes("gpt-5-pro") || slug.includes("gpt-5.4-pro")) {
      return { configurable: true, levels: ["high"] };
    }
    if (slug.startsWith("gpt-5") || slug.startsWith("o1") || slug.startsWith("o3") || slug.startsWith("o4")) {
      // Legacy GPT-5 / o-series: minimal–high is the common intersection.
      return { configurable: true, levels: ["minimal", "low", "medium", "high"] };
    }

    return NO_EFFORT;
  }

  if (provider === "anthropic") {
    if (slug.includes("fable") || slug.includes("mythos")) return ANTHROPIC_ADAPTIVE_FULL;
    if (slug.includes("opus-4.8") || slug.includes("opus-4-8")) return ANTHROPIC_ADAPTIVE_FULL;
    if (slug.includes("opus-4.7") || slug.includes("opus-4-7")) return ANTHROPIC_ADAPTIVE_FULL;
    if (slug.includes("sonnet-5") || slug.includes("sonnet-4.6") || slug.includes("sonnet-4-6")) {
      return ANTHROPIC_ADAPTIVE_FULL;
    }
    if (slug.includes("opus-4.6") || slug.includes("opus-4-6") || slug.includes("opus-4.5")) {
      return ANTHROPIC_ADAPTIVE_NO_XHIGH;
    }
    if (slug.includes("haiku")) return ANTHROPIC_BUDGET;

    return ANTHROPIC_ADAPTIVE_NO_XHIGH;
  }

  if (provider === "google") {
    if (slug.includes("2.5-flash-lite") || slug.includes("2.5-flash")) return GOOGLE_25_FLASH_BUDGET;
    if (slug.includes("2.5-pro")) return GOOGLE_25_PRO_BUDGET;
    if (slug.includes("3.1-pro") || (slug.includes("3-pro") && !slug.includes("flash"))) {
      return GOOGLE_PRO_LEVELS;
    }
    if (slug.includes("gemini-3") || slug.includes("3.5-flash") || slug.includes("3-flash")) {
      return GOOGLE_FLASH_LEVELS;
    }

    return NO_EFFORT;
  }

  return NO_EFFORT;
}

/** Rows for the effort selector (always includes Auto). */
export function getEffortLevelsForModel(modelId: string): ChatEffortLevelRow[] {
  const capability = getEffortCapabilityForModel(modelId);

  if (!capability.configurable) {
    return [LEVEL_BY_ID.auto];
  }

  return [
    LEVEL_BY_ID.auto,
    ...capability.levels.map((id) => LEVEL_BY_ID[id]),
  ];
}

export function modelSupportsEffortControl(modelId: string): boolean {
  return getEffortCapabilityForModel(modelId).configurable;
}

/**
 * Snap a requested effort to the closest supported value for this model.
 * Unsupported non-auto requests clamp by rank; models without control → auto.
 */
export function clampEffortForModel(
  modelId: string,
  effort: ChatEffortLevel | undefined
): ChatEffortLevel {
  const requested = effort ?? DEFAULT_CHAT_EFFORT;

  if (requested === "auto") return "auto";

  const capability = getEffortCapabilityForModel(modelId);

  if (!capability.configurable || capability.levels.length === 0) {
    return "auto";
  }

  if (capability.levels.includes(requested)) {
    return requested;
  }

  // Treat none ↔ minimal as near-equivalents when only one is available.
  if (requested === "none" && capability.levels.includes("minimal")) return "minimal";
  if (requested === "minimal" && capability.levels.includes("none")) return "none";
  if (requested === "max" && capability.levels.includes("xhigh")) return "xhigh";
  if (requested === "xhigh" && capability.levels.includes("max")) return "max";

  const reqRank = EFFORT_RANK[requested];
  let best: Exclude<ChatEffortLevel, "auto"> = capability.levels[0];
  let bestDist = Number.POSITIVE_INFINITY;

  for (const level of capability.levels) {
    const dist = Math.abs(EFFORT_RANK[level] - reqRank);

    if (dist < bestDist || (dist === bestDist && EFFORT_RANK[level] > EFFORT_RANK[best])) {
      best = level;
      bestDist = dist;
    }
  }

  return best;
}

type EffortProviderOptions = {
  openai?: OpenAIResponsesProviderOptions;
  /** SDK types may lag gateway fields; JSONValue keeps streamText providerOptions assignable. */
  anthropic?: AnthropicProviderOptions | Record<string, JSONValue>;
  google?: GoogleGenerativeAIProviderOptions | Record<string, JSONValue>;
};

function anthropicSlugUsesBudgetTokens(slug: string): boolean {
  return slug.includes("haiku");
}

function anthropicAdaptiveRequiresExplicitThinking(slug: string): boolean {
  // Opus 4.8 / 4.7: thinking off unless adaptive is set. Fable always-on (omit ok).
  // Sonnet 5: adaptive on by default.
  return (
    slug.includes("opus-4.8") ||
    slug.includes("opus-4-8") ||
    slug.includes("opus-4.7") ||
    slug.includes("opus-4-7") ||
    slug.includes("opus-4.6") ||
    slug.includes("opus-4-6")
  );
}

function anthropicCanDisableThinking(slug: string): boolean {
  return !(slug.includes("fable") || slug.includes("mythos"));
}

function googleUsesThinkingLevel(slug: string): boolean {
  return slug.includes("gemini-3") || /gemini-3\./.test(slug) || slug.startsWith("3.");
}

/** Map a unified effort level to provider-specific streamText options for the given model. */
export function buildEffortProviderOptions(
  modelId: string,
  effort: ChatEffortLevel | undefined
): EffortProviderOptions | undefined {
  const clamped = clampEffortForModel(modelId, effort);

  if (clamped === "auto") return undefined;

  const resolvedId =
    modelId === AUTO_CHAT_MODEL_ID ? AUTO_RESOLVED_SONNET_MODEL_ID : modelId;
  const provider = providerOf(resolvedId);
  const slug = stripProviderPrefix(resolvedId).toLowerCase();

  if (provider === "openai") {
    return {
      openai: {
        // Installed SDK types may lag (e.g. omit `max`); gateway accepts current API values.
        reasoningEffort: clamped as OpenAIResponsesProviderOptions["reasoningEffort"],
      } satisfies OpenAIResponsesProviderOptions,
    };
  }

  if (provider === "anthropic") {
    if (anthropicSlugUsesBudgetTokens(slug)) {
      if (clamped === "none") {
        return {
          anthropic: {
            thinking: { type: "disabled" },
          } satisfies AnthropicProviderOptions,
        };
      }

      const budgetTokens = ANTHROPIC_BUDGET_TOKENS[clamped];

      return {
        anthropic: {
          thinking: { type: "enabled", budgetTokens },
        } satisfies AnthropicProviderOptions,
      };
    }

    // Adaptive + effort (Sonnet 5, Opus 4.8, Fable, …). Gateway forwards newer fields
    // even when local @ai-sdk/anthropic types only know budget-based thinking.
    if (clamped === "none") {
      if (!anthropicCanDisableThinking(slug)) {
        return {
          anthropic: {
            thinking: { type: "adaptive" },
            effort: "low",
          } as unknown as AnthropicProviderOptions,
        };
      }

      return {
        anthropic: {
          thinking: { type: "disabled" },
        } as AnthropicProviderOptions,
      };
    }

    const adaptiveEffort =
      clamped === "minimal" ? "low" : (clamped as "low" | "medium" | "high" | "xhigh" | "max");

    if (anthropicAdaptiveRequiresExplicitThinking(slug) || slug.includes("fable")) {
      return {
        anthropic: {
          thinking: { type: "adaptive" },
          effort: adaptiveEffort,
        } as unknown as AnthropicProviderOptions,
      };
    }

    // Sonnet 5: adaptive is default; still set thinking explicitly for clarity with effort.
    return {
      anthropic: {
        thinking: { type: "adaptive" },
        effort: adaptiveEffort,
      } as unknown as AnthropicProviderOptions,
    };
  }

  if (provider === "google") {
    if (googleUsesThinkingLevel(slug)) {
      if (clamped === "none") {
        // Gemini 3.x cannot disable thinking; map to lowest available level.
        const level = slug.includes("pro") ? "low" : "minimal";

        return {
          google: {
            thinkingConfig: { thinkingLevel: level },
          } as GoogleGenerativeAIProviderOptions,
        };
      }

      const level =
        clamped === "xhigh" || clamped === "max"
          ? "high"
          : clamped === "minimal" || clamped === "low" || clamped === "medium" || clamped === "high"
            ? clamped
            : "medium";

      return {
        google: {
          thinkingConfig: { thinkingLevel: level },
        } as GoogleGenerativeAIProviderOptions,
      };
    }

    // Gemini 2.5 thinkingBudget
    if (clamped === "none") {
      return {
        google: {
          thinkingConfig: { thinkingBudget: 0 },
        } satisfies GoogleGenerativeAIProviderOptions,
      };
    }

    const thinkingBudget = GOOGLE_25_BUDGET_TOKENS[clamped];

    return {
      google: {
        thinkingConfig: { thinkingBudget },
      } satisfies GoogleGenerativeAIProviderOptions,
    };
  }

  return undefined;
}

export function getChatEffortLabel(effort: ChatEffortLevel): string {
  return LEVEL_BY_ID[effort]?.name ?? effort;
}
