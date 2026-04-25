import type { ChatModel } from "@/lib/schemas/chat";

import { DEFAULT_CHAT_MODEL, ChatModels } from "@/lib/schemas/chat";

export const STRATA_ASSISTANT_PERSONA_IDS = ["remy", "spark", "aion", "prometheus"] as const;

export type StrataAssistantPersonaId = (typeof STRATA_ASSISTANT_PERSONA_IDS)[number];

export type StrataAssistantToolDefaults = {
  toolMemory: boolean;
  toolWebSearch: boolean;
  toolMessageSearch: boolean;
  toolKnowledgeSearch: boolean;
};

export type StrataAssistantPersonaDefinition = {
  id: StrataAssistantPersonaId;
  label: string;
  shortLabel: string;
  getSystemPromptAugmentation: () => string;
  getDefaultModel: () => ChatModel;
  getDefaultToolDefaults: () => StrataAssistantToolDefaults;
};

const DEFAULT_TOOLS: StrataAssistantToolDefaults = {
  toolMemory: true,
  toolWebSearch: false,
  toolMessageSearch: true,
  toolKnowledgeSearch: false,
};

function pickModel(id: string): ChatModel {
  const found = ChatModels.find((m) => m.id === id);

  return found ?? DEFAULT_CHAT_MODEL;
}

const DEFINITIONS: Record<StrataAssistantPersonaId, StrataAssistantPersonaDefinition> = {
  remy: {
    id: "remy",
    label: "Remy — culinary",
    shortLabel: "Remy",
    getSystemPromptAugmentation: () =>
      "\n\n[Persona: Remy]\nLean toward food, cooking technique, ingredients, menus, hospitality, and sensory language when relevant. Stay accurate; do not invent recipes or safety-critical temperatures.",
    getDefaultModel: () => pickModel("openai/gpt-5.4"),
    getDefaultToolDefaults: () => ({ ...DEFAULT_TOOLS, toolWebSearch: true }),
  },
  spark: {
    id: "spark",
    label: "Spark — financial",
    shortLabel: "Spark",
    getSystemPromptAugmentation: () =>
      "\n\n[Persona: Spark]\nLean toward markets, investing vocabulary, risk, and business finance when relevant. Do not give individualized investment advice or promises about returns.",
    getDefaultModel: () => pickModel("openai/gpt-5.4"),
    getDefaultToolDefaults: () => ({ ...DEFAULT_TOOLS, toolWebSearch: true }),
  },
  aion: {
    id: "aion",
    label: "Aion — broad / omniscient tone",
    shortLabel: "Aion",
    getSystemPromptAugmentation: () =>
      "\n\n[Persona: Aion]\nUse a calm, encyclopedic tone across domains. Prefer structured explanations and clear definitions when the user spans multiple topics.",
    getDefaultModel: () => pickModel("google/gemini-3.1-pro-preview"),
    getDefaultToolDefaults: () => ({
      ...DEFAULT_TOOLS,
      toolWebSearch: true,
      toolKnowledgeSearch: true,
    }),
  },
  prometheus: {
    id: "prometheus",
    label: "Prometheus — technical",
    shortLabel: "Prometheus",
    getSystemPromptAugmentation: () =>
      "\n\n[Persona: Prometheus]\nLean toward software, systems, scientific reasoning, and engineering tradeoffs when relevant. Prefer precise terminology and reproducible steps.",
    getDefaultModel: () => pickModel("anthropic/claude-sonnet-4.6"),
    getDefaultToolDefaults: () => ({
      ...DEFAULT_TOOLS,
      toolWebSearch: true,
      toolMessageSearch: true,
    }),
  },
};

export function isStrataAssistantPersonaId(v: string): v is StrataAssistantPersonaId {
  return (STRATA_ASSISTANT_PERSONA_IDS as readonly string[]).includes(v);
}

export function getStrataAssistantPersona(id: string): StrataAssistantPersonaDefinition {
  if (isStrataAssistantPersonaId(id)) return DEFINITIONS[id];

  return DEFINITIONS.prometheus;
}

export function listStrataAssistantPersonas(): StrataAssistantPersonaDefinition[] {
  return STRATA_ASSISTANT_PERSONA_IDS.map((id) => DEFINITIONS[id]);
}

const STRATA_PERSONA_ROUTING_NOTE =
  "Strata page assistant: POST /api/chat with experience=strata_page, strataAssistantPersona in the JSON body, and optional strataPageId. The server merges getSystemPromptAugmentation() after the base system prompt and buildStrataSystemSuffix() (Strata page grounding). Default model and tool defaults are client hints; the request may override model.";

export type StrataAssistantPersonaInspectorSnapshot = {
  id: StrataAssistantPersonaId;
  label: string;
  shortLabel: string;
  systemPromptAugmentation: string;
  defaultModel: { id: string; name: string };
  defaultToolDefaults: StrataAssistantToolDefaults;
  routingNote: string;
};

export function buildStrataAssistantPersonaInspectorSnapshot(
  id: StrataAssistantPersonaId | string
): StrataAssistantPersonaInspectorSnapshot {
  const def = getStrataAssistantPersona(id);
  const model = def.getDefaultModel();

  return {
    id: def.id,
    label: def.label,
    shortLabel: def.shortLabel,
    systemPromptAugmentation: def.getSystemPromptAugmentation(),
    defaultModel: { id: model.id, name: model.name },
    defaultToolDefaults: def.getDefaultToolDefaults(),
    routingNote: STRATA_PERSONA_ROUTING_NOTE,
  };
}
