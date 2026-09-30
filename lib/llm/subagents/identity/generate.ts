import { experimental_generateImage as generateImage } from "ai";
import { openai } from "@ai-sdk/openai";

import type { SubagentIdentity } from "@/lib/schemas/subagent-runtime";

import { buildSubagentIdentityPrompt } from "@/lib/llm/subagents/identity/prompt";
import { createLogger } from "@/lib/logger";

const logger = createLogger("lib/llm/subagents/identity/generate");

/** Existing OpenAI image model via @ai-sdk/openai — no new provider. */
export const SUBAGENT_IDENTITY_IMAGE_MODEL = "gpt-image-1-mini" as const;

export type GeneratedIdentityImage = {
  bytes: Uint8Array;
  mediaType: string;
  prompt: string;
};

export type IdentityImageGenerator = (
  identity: SubagentIdentity
) => Promise<GeneratedIdentityImage>;

/**
 * Generate an abstract non-human identity mark with the repo's OpenAI image path.
 */
export const generateSubagentIdentityImage: IdentityImageGenerator = async (identity) => {
  const prompt = buildSubagentIdentityPrompt({
    name: identity.name,
    displayRole: identity.displayRole,
    runtimeRole: identity.runtimeRole,
    surfaceTraits: identity.surfaceTraits,
  });

  try {
    const result = await generateImage({
      model: openai.image(SUBAGENT_IDENTITY_IMAGE_MODEL),
      prompt,
      size: "1024x1024",
    });

    const image = result.image;

    return {
      bytes: image.uint8Array,
      mediaType: image.mediaType || "image/png",
      prompt,
    };
  } catch (err) {
    logger.error(
      "generateSubagentIdentityImage",
      err instanceof Error ? err.message : String(err)
    );
    throw err;
  }
};
