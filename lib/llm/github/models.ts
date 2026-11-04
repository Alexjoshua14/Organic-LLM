import type { GithubDistiller } from "@/lib/github/policy";

import { models } from "@/lib/schemas/chat-models";

/**
 * Cheap zero-data-retention gateway models used to distill repository text.
 * `kimi` is Kimi K2.7 Code: the code-oriented Kimi family pin, not the K3 chat picker.
 * `terra` is the catalog alias, currently pinned to GPT-6 Sol.
 */
export const GITHUB_DISTILLER_MODEL_IDS: Record<GithubDistiller, string> = {
  luna: models.openai.luna.id,
  terra: models.openai.terra.id,
  haiku: models.anthropic.haiku.id,
  kimi: models.moonshotai.kimiCode.id,
};

export const GITHUB_JEV_MODEL_ID = "typesafe-ai/jev";
