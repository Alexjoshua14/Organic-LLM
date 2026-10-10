import "server-only";

import { generateObject } from "ai";

import {
  buildReleaseNotesUserPrompt,
  RELEASE_NOTES_SYSTEM_PROMPT,
} from "@/lib/release-notes/prompts";
import { createLogger } from "@/lib/logger";
import { recordLlmCall } from "@/lib/llm/metrics";
import { KNOWLEDGE_GATEWAY_PROVIDER_OPTIONS } from "@/lib/knowledge/gateway-options";
import { models } from "@/lib/schemas/chat-models";
import { ReleaseNotes, ReleaseNotesSchema } from "@/lib/schemas/release-notes";

const logger = createLogger("lib/release-notes/generate.ts");

/** Fast, accurate structured model already in the catalog (Luna). */
export const RELEASE_NOTES_MODEL = models.openai.luna.id;

/** Stable prompt-cache key so the system instructions stay a shared prefix. */
export const RELEASE_NOTES_PROMPT_CACHE_KEY = "organic-llm-release-notes-v1";

export type GenerateReleaseNotesInput = {
  fromSha: string;
  toSha: string;
  fromVersion: string | null;
  toVersion: string | null;
  commitLog: string;
};

export type GenerateReleaseNotesResult = {
  notes: ReleaseNotes;
  model: string;
};

export type ReleaseNotesGenerator = (
  input: GenerateReleaseNotesInput
) => Promise<GenerateReleaseNotesResult>;

/**
 * One structured model call over the real commit range.
 * System prompt is stable (provider prompt-cache friendly); user prompt is only the commit list.
 * Never sends user messages, memories, or chat history.
 */
export const generateReleaseNotesWithLlm: ReleaseNotesGenerator = async (input) => {
  const prompt = buildReleaseNotesUserPrompt(input);
  const started = performance.now();

  try {
    const { object, usage } = await generateObject({
      model: RELEASE_NOTES_MODEL,
      instructions: RELEASE_NOTES_SYSTEM_PROMPT,
      prompt,
      schema: ReleaseNotesSchema,
      maxOutputTokens: 1_200,
      temperature: 0.2,
      providerOptions: {
        ...KNOWLEDGE_GATEWAY_PROVIDER_OPTIONS,
        openai: {
          promptCacheKey: RELEASE_NOTES_PROMPT_CACHE_KEY,
          promptCacheRetention: "24h",
        },
      },
    });

    recordLlmCall({
      model: RELEASE_NOTES_MODEL,
      usage,
      durationMs: performance.now() - started,
      metadata: { operation: "releaseNotes" },
    });

    return { notes: object, model: RELEASE_NOTES_MODEL };
  } catch (err) {
    logger.error(
      "generateReleaseNotesWithLlm",
      err instanceof Error ? err.message : String(err)
    );
    throw err;
  }
};

/** Assert the variable (commit-list) prompt contains no user/chat/memory payloads. */
export function assertPromptExcludesUserContent(prompt: string): boolean {
  const banned = [
    /"role"\s*:\s*"user"/i,
    /chat history:/i,
    /user messages?:/i,
    /mem0/i,
    /memory lens/i,
    /clerk user/i,
  ];

  return !banned.some((re) => re.test(prompt));
}
