import "server-only";

import type { LanguageModel } from "ai";
import { generateObject, NoObjectGeneratedError } from "ai";
import { openai } from "@ai-sdk/openai";
import type { OpenAIResponsesProviderOptions } from "@ai-sdk/openai";

import {
  MEMORY_QUALITY_CLASSIFIER_SYSTEM,
  MemoryQualitySchema,
  parseMemoryQualityFromModelText,
  type MemoryQuality,
} from "@/lib/memory/ingest-quality";

export type ClassifyMemoryQualityDeps = {
  generateObjectImpl?: typeof generateObject;
  model?: LanguageModel;
};

const defaultModel = openai(process.env.MIGRATE_QUALITY_MODEL ?? "gpt-5.4-mini");

export async function classifyMemoryQuality(
  text: string,
  deps: ClassifyMemoryQualityDeps = {},
  onLatencyMs?: (ms: number) => void
): Promise<MemoryQuality> {
  const generateObjectImpl = deps.generateObjectImpl ?? generateObject;
  const model = deps.model ?? defaultModel;
  const t0 = performance.now();

  try {
    const { object } = await generateObjectImpl({
      model,
      schema: MemoryQualitySchema,
      maxOutputTokens: 300,
      providerOptions: {
        openai: {
          store: false,
        } satisfies OpenAIResponsesProviderOptions,
      },
      system: MEMORY_QUALITY_CLASSIFIER_SYSTEM,
      prompt: `Classify this memory line:\n\n${text.slice(0, 8000)}`,
    });

    return object;
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err) && typeof err.text === "string") {
      const repaired = parseMemoryQualityFromModelText(err.text);

      if (repaired) {
        return repaired;
      }
    }
    throw err;
  } finally {
    onLatencyMs?.(performance.now() - t0);
  }
}

export {
  MEMORY_QUALITY_CLASSIFIER_SYSTEM,
  MemoryQualitySchema,
  parseMemoryQualityFromModelText,
  scoreIngestOutputDeterministic,
  distillCandidateFromTurns,
  type MemoryIngestGoldenCase,
  type DeterministicIngestScore,
  type MemoryQuality,
} from "@/lib/memory/ingest-quality";
