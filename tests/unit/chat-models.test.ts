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

  test("openai.terra is an internal GPT-6 Sol pin", () => {
    expect(models.openai.terra.id).toBe(models.openai.sol.id);
    expect(models.openai.terra.picker).toBe(false);
    expect(ChatModels.some((model) => model.alias === "openai.terra")).toBe(false);
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
