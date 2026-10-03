import { describe, expect, test } from "bun:test";

import {
  AUTO_CHAT_MODEL_ID,
  AUTO_RESOLVED_SONNET_MODEL_ID,
  CHAT_MODEL_ALIASES,
  ChatModelCatalog,
  ChatModels,
  DEFAULT_CHAT_MODEL,
  MODEL_ALIASES,
  models,
  chatModelByAlias,
  chatModelById,
  providerModelSlug,
  requireChatModel,
  type ChatModel,
  type ModelAlias,
  type ModelProvider,
} from "@/lib/schemas/chat";

function everyModelsLeaf(): Array<{ alias: ModelAlias; row: ChatModel }> {
  const leaves: Array<{ alias: ModelAlias; row: ChatModel }> = [];

  for (const [provider, families] of Object.entries(MODEL_ALIASES) as [
    ModelProvider,
    readonly string[],
  ][]) {
    for (const family of families) {
      const alias = `${provider}.${family}` as ModelAlias;
      const row = (models[provider] as Record<string, ChatModel>)[family]!;
      leaves.push({ alias, row });
    }
  }

  return leaves;
}

describe("ChatModel catalog aliases", () => {
  test("every catalog row has a unique alias covering MODEL_ALIASES", () => {
    const seen = new Map<string, number>();

    for (const row of ChatModelCatalog) {
      expect(row.alias).toBeDefined();
      seen.set(row.alias!, (seen.get(row.alias!) ?? 0) + 1);
    }

    for (const alias of CHAT_MODEL_ALIASES) {
      expect(seen.get(alias)).toBe(1);
      expect(chatModelByAlias(alias).alias).toBe(alias);
    }

    expect(seen.size).toBe(CHAT_MODEL_ALIASES.length);
    expect(ChatModelCatalog).toHaveLength(CHAT_MODEL_ALIASES.length);
  });

  test("models.provider.family leaves match catalog rows", () => {
    const leaves = everyModelsLeaf();

    expect(leaves).toHaveLength(CHAT_MODEL_ALIASES.length);

    for (const { alias, row } of leaves) {
      expect(row.alias).toBe(alias);
      expect(chatModelByAlias(alias)).toEqual(row);
      // Multiple aliases may share a gateway id (e.g. terra → sol after GPT-6).
      expect(chatModelById(row.id)?.id).toBe(row.id);
    }
  });

  test("openai.terra is an internal GPT-6.1 Sol pin", () => {
    expect(models.openai.sol.id).toBe("openai/gpt-6.1-sol");
    expect(models.openai.terra.id).toBe(models.openai.sol.id);
    expect(models.openai.terra.picker).toBe(false);
    expect(ChatModels.some((model) => model.alias === "openai.terra")).toBe(false);
  });

  test("openai.jev is an internal Luna pin with mandatory ZDR", () => {
    expect(models.openai.jev.id).toBe(models.openai.luna.id);
    expect(models.openai.jev.picker).toBe(false);
    expect(models.openai.jev.requiresZeroDataRetention).toBe(true);
    expect(ChatModels.some((model) => model.alias === "openai.jev")).toBe(false);
  });

  test("older Gemini and Kimi aliases pin to the current heads", () => {
    expect(models.google.flash.id).toBe("google/gemini-3.8-flash");
    expect(models.google.flash3.id).toBe(models.google.flash.id);
    expect(models.google.flash3.picker).toBe(false);
    expect(models.google.flashLite.id).toBe("google/gemini-3.5-flash-lite");
    expect(models.google.flashLite_2_5.id).toBe(models.google.flashLite.id);
    expect(models.google.flashLite_2_5.picker).toBe(false);
    expect(models.google.flashLite_3_1.id).toBe(models.google.flashLite.id);
    expect(models.google.flashLite_3_1.picker).toBe(false);
    expect(models.moonshotai.kimi.id).toBe("moonshotai/kimi-k3");
    expect(models.moonshotai.kimi_2_6.id).toBe(models.moonshotai.kimi.id);
    expect(models.moonshotai.kimi_2_6.picker).toBe(false);
    expect(ChatModels.some((model) => model.alias === "google.flash3")).toBe(false);
    expect(ChatModels.some((model) => model.alias === "moonshotai.kimi_2_6")).toBe(false);
  });

  test("perplexity.reasoningPro is an internal Sonar pin", () => {
    expect(models.perplexity.pro.id).toBe("perplexity/sonar");
    expect(models.perplexity.reasoningPro.id).toBe(models.perplexity.pro.id);
    expect(models.perplexity.reasoningPro.picker).toBe(false);
    expect(ChatModels.some((model) => model.alias === "perplexity.reasoningPro")).toBe(false);
  });

  test("picker excludes picker: false rows and starts with Auto", () => {
    expect(ChatModels[0]?.id).toBe(AUTO_CHAT_MODEL_ID);

    const pickerAliases = new Set(
      ChatModels.map((model) => model.alias).filter((alias): alias is ModelAlias => Boolean(alias))
    );
    const internal = ChatModelCatalog.filter((model) => model.picker === false);

    expect(internal.length).toBeGreaterThan(0);

    for (const row of internal) {
      expect(pickerAliases.has(row.alias!)).toBe(false);
      expect(requireChatModel(row.id).id).toBe(row.id);
    }
  });

  test("DEFAULT_CHAT_MODEL and Auto-resolved Sonnet track models aliases", () => {
    expect(DEFAULT_CHAT_MODEL).toEqual(models.openai.flagship);
    expect(AUTO_RESOLVED_SONNET_MODEL_ID).toBe(models.anthropic.sonnet.id);
  });

  test("providerModelSlug strips the gateway prefix", () => {
    expect(providerModelSlug("openai/example-model")).toBe("example-model");
    expect(providerModelSlug("example-model")).toBe("example-model");
  });
});
