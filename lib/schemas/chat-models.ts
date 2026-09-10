import type { GatewayModelId } from "@ai-sdk/gateway";

import { AUTO_CHAT_MODEL_ID } from "@/lib/schemas/chat-model-ids";

export type ChatModelId = GatewayModelId | typeof AUTO_CHAT_MODEL_ID;

export const MODEL_ALIASES = {
  openai: ["flagship", "sol", "terra", "luna", "oss120b", "oss20b", "gpt4oMini"],
  google: ["pro", "flash", "flash3", "flashLite", "flashLite_2_5", "flashLite_3_1"],
  anthropic: ["opus", "sonnet", "haiku", "fable"],
  perplexity: ["pro", "reasoningPro"],
  moonshotai: ["kimi", "kimiCode", "kimi_2_6"],
  deepseek: ["pro", "flash"],
} as const;

export type ModelProvider = keyof typeof MODEL_ALIASES;

export type ModelAlias = {
  [P in ModelProvider]: `${P}.${(typeof MODEL_ALIASES)[P][number]}`;
}[ModelProvider];

/** Flat list of every dotted alias (for tests / iteration). */
export const CHAT_MODEL_ALIASES: readonly ModelAlias[] = (
  Object.entries(MODEL_ALIASES) as [ModelProvider, readonly string[]][]
).flatMap(([provider, families]) =>
  families.map((family) => `${provider}.${family}` as ModelAlias)
);

export type ChatModelAlias = ModelAlias;

export type ChatModel = {
  id: ChatModelId;
  name: string;
  /** Developer family index. At most one catalog row per alias. Not persisted. */
  alias?: ModelAlias;
  /** When false, the row is catalog-only and omitted from the composer picker. Default true. */
  picker?: boolean;
  supportsZeroDataRetention?: boolean;
  /** Only selectable by admins (profiles.admin); enforced server-side in the chat route. */
  adminOnly?: boolean;
};

export const AUTO_CHAT_MODEL: ChatModel = {
  id: AUTO_CHAT_MODEL_ID,
  name: "Auto",
  supportsZeroDataRetention: true,
};

/**
 * Full catalog: picker rows plus internal pins (`picker: false`).
 * Every row has a provider-family alias.
 */
const catalog: ChatModel[] = [
  {
    id: "openai/gpt-6-astra",
    name: "GPT-6 Astra",
    alias: "openai.flagship",
    supportsZeroDataRetention: true,
  },
  {
    id: "openai/gpt-5.6-sol",
    name: "GPT-5.6 Sol",
    alias: "openai.sol",
    supportsZeroDataRetention: true,
  },
  {
    id: "openai/gpt-5.6-terra",
    name: "GPT-5.6 Terra",
    alias: "openai.terra",
    supportsZeroDataRetention: true,
  },
  {
    id: "openai/gpt-5.6-luna",
    name: "GPT-5.6 Luna",
    alias: "openai.luna",
    supportsZeroDataRetention: true,
  },
  {
    id: "openai/gpt-oss-120b",
    name: "GPT OSS [120b]",
    alias: "openai.oss120b",
    supportsZeroDataRetention: true,
  },
  {
    id: "openai/gpt-oss-20b",
    name: "GPT OSS [20b]",
    alias: "openai.oss20b",
    supportsZeroDataRetention: true,
  },
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    alias: "openai.gpt4oMini",
    picker: false,
    supportsZeroDataRetention: true,
  },
  {
    id: "google/gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro",
    alias: "google.pro",
    supportsZeroDataRetention: true,
  },
  {
    id: "google/gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    alias: "google.flash",
    supportsZeroDataRetention: true,
  },
  {
    id: "google/gemini-3-flash",
    name: "Gemini 3 Flash",
    alias: "google.flash3",
    supportsZeroDataRetention: true,
  },
  {
    id: "google/gemini-3.5-flash-lite",
    name: "Gemini 3.5 Flash Lite",
    alias: "google.flashLite",
    supportsZeroDataRetention: true,
  },
  {
    id: "google/gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    alias: "google.flashLite_2_5",
    supportsZeroDataRetention: true,
  },
  {
    id: "google/gemini-3.1-flash-lite",
    name: "Gemini 3.1 Flash Lite",
    alias: "google.flashLite_3_1",
    picker: false,
    supportsZeroDataRetention: true,
  },
  {
    id: "anthropic/claude-opus-5",
    name: "Claude Opus 5",
    alias: "anthropic.opus",
    supportsZeroDataRetention: true,
  },
  {
    id: "anthropic/claude-sonnet-5",
    name: "Claude Sonnet 5",
    alias: "anthropic.sonnet",
    supportsZeroDataRetention: true,
  },
  {
    id: "anthropic/claude-haiku-4.5",
    name: "Claude Haiku 4.5",
    alias: "anthropic.haiku",
    supportsZeroDataRetention: true,
  },
  {
    // Fable 5.1 is not ZDR-compatible (gateway `zdr: none`).
    id: "anthropic/claude-fable-5.1",
    name: "Claude Fable 5.1",
    alias: "anthropic.fable",
    supportsZeroDataRetention: false,
  },
  {
    id: "perplexity/sonar-pro",
    name: "Sonar Pro",
    alias: "perplexity.pro",
    supportsZeroDataRetention: false,
  },
  {
    id: "perplexity/sonar-reasoning-pro",
    name: "Sonar Reasoning Pro",
    alias: "perplexity.reasoningPro",
    supportsZeroDataRetention: false,
  },
  {
    id: "moonshotai/kimi-k3",
    name: "Kimi K3",
    alias: "moonshotai.kimi",
    supportsZeroDataRetention: true,
  },
  {
    id: "moonshotai/kimi-k2.7-code",
    name: "Kimi K2.7 Code",
    alias: "moonshotai.kimiCode",
    supportsZeroDataRetention: true,
  },
  {
    id: "moonshotai/kimi-k2.6",
    name: "Kimi K2.6",
    alias: "moonshotai.kimi_2_6",
    supportsZeroDataRetention: true,
  },
  {
    id: "deepseek/deepseek-v4-pro",
    name: "DeepSeek v4 Pro",
    alias: "deepseek.pro",
    supportsZeroDataRetention: true,
  },
  {
    id: "deepseek/deepseek-v4-flash",
    name: "DeepSeek v4 Flash",
    alias: "deepseek.flash",
    supportsZeroDataRetention: true,
  },
];

function isPickerRow(model: ChatModel): boolean {
  return model.picker !== false;
}

function buildAliasIndex(rows: ChatModel[]): Map<ModelAlias, ChatModel> {
  const map = new Map<ModelAlias, ChatModel>();

  for (const row of rows) {
    if (!row.alias) {
      throw new Error(`ChatModel missing alias: ${row.id}`);
    }
    if (map.has(row.alias)) {
      throw new Error(`Duplicate ChatModel alias: ${row.alias}`);
    }
    map.set(row.alias, row);
  }

  for (const alias of CHAT_MODEL_ALIASES) {
    if (!map.has(alias)) {
      throw new Error(`Missing ChatModel for alias: ${alias}`);
    }
  }

  return map;
}

const aliasIndex = buildAliasIndex(catalog);

export const ChatModelCatalog: ChatModel[] = catalog;

/** First entry is Auto; remaining entries are picker-visible catalog rows. */
export const ChatModels: ChatModel[] = [AUTO_CHAT_MODEL, ...catalog.filter(isPickerRow)];

export function chatModelByAlias(alias: ModelAlias): ChatModel {
  const row = aliasIndex.get(alias);

  if (!row) {
    throw new Error(`Missing ChatModel for alias: ${alias}`);
  }

  return row;
}

type ModelsTree = {
  [P in ModelProvider]: {
    [F in (typeof MODEL_ALIASES)[P][number]]: ChatModel;
  };
};

function assignProviderBranch<P extends ModelProvider>(
  tree: ModelsTree,
  provider: P,
  index: Map<ModelAlias, ChatModel>
): void {
  const families = MODEL_ALIASES[provider];
  const branch = {} as ModelsTree[P];

  for (const family of families) {
    const alias = `${provider}.${family}` as ModelAlias;
    const row = index.get(alias);

    if (!row) {
      throw new Error(`Missing ChatModel for alias: ${alias}`);
    }

    (branch as Record<string, ChatModel>)[family] = row;
  }

  tree[provider] = branch;
}

function buildModelsTree(index: Map<ModelAlias, ChatModel>): ModelsTree {
  const tree = {} as ModelsTree;

  for (const provider of Object.keys(MODEL_ALIASES) as ModelProvider[]) {
    assignProviderBranch(tree, provider, index);
  }

  return tree;
}

/** Provider → family lookups for app code. Persist and display `id` / `name`, not the alias. */
export const models: ModelsTree = buildModelsTree(aliasIndex);

export const DEFAULT_CHAT_MODEL: ChatModel = models.openai.flagship;

/** Non-Delphi Auto resolves to this gateway id (single policy knob). */
export const AUTO_RESOLVED_SONNET_MODEL_ID = models.anthropic.sonnet.id;

export function chatModelById(id: string): ChatModel | undefined {
  if (id === AUTO_CHAT_MODEL.id) return AUTO_CHAT_MODEL;

  return catalog.find((model) => model.id === id);
}

export function requireChatModel(id: string): ChatModel {
  const row = chatModelById(id);

  if (!row) {
    throw new Error(`Missing ChatModel: ${id}`);
  }

  return row;
}

/** Unprefixed slug for `@ai-sdk/openai` (`openai("gpt-5.6-luna")`). */
export function providerModelSlug(modelId: string): string {
  const slash = modelId.indexOf("/");

  return slash >= 0 ? modelId.slice(slash + 1) : modelId;
}

/** Models the given user may select; hides `adminOnly` entries from non-admins. */
export function getSelectableChatModels(isAdmin: boolean): ChatModel[] {
  return isAdmin ? ChatModels : ChatModels.filter((m) => !m.adminOnly);
}
