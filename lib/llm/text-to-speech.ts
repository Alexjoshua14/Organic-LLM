"use server";

import { openai } from "@ai-sdk/openai";
import {
  GeneratedAudioFile,
  generateObject,
  experimental_generateSpeech as generateSpeech,
  generateText,
} from "ai";
import z from "zod";

import { createLogger } from "../logger";
import { GUARDRAIL_MAX_OUTPUT_TOKENS } from "./helpers";
import { recordLlmCall } from "@/lib/llm/metrics";

const logger = createLogger("lib/llm/text-to-speech.ts");

const textCache = new Map<string, { text: string; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

const SpeechFriendlySystemPrompt = `
You are a helpful assistant that transforms text to speech-friendly text.

Rules:
- Make the text speech-friendly.
- Do not change the text unless it is necessary to make it speech-friendly.
- If an aspect of the text is very visible, like a code block, list, image, diagram, describe what it so the listener can understand it.
- The text you return should line up perfectly with the text input.
- You should convert special characters to speech-friendly characters if reasonable.
- The output should be able to go through a AI TTS model and generate audio that lines up perfectly with the original text.
- Output ONLY the transformed text.
- Do not include any other text in your response.
`;

const ValidationSchema = z.object({
  valid: z.boolean(),
  reason: z.string(),
});

const ValidationCriteria = `
- Does the text line up perfectly with the original text?
- Are there any special characters that are not speech-friendly?
- Are there any numbers that are not speech-friendly?
- Are there any symbols that are not speech-friendly?
- Are there any contractions that are not speech-friendly?
- Are there any proper nouns that are not speech-friendly?
- Are there any other issues that are not speech-friendly?
- Are there all aspects of the text that are very visible, like a code block, list, image, diagram, that described well for the listener to understand it via audio alone?
`;

const ValidationSystemPrompt = `
You are a helpful assistant that validates text to speech-friendly text.

Rules:
- Validate the text to speech-friendly text.
- You should check for the following:
  ${ValidationCriteria}
- Return valid = TRUE if the text is speech-friendly and meets all the criteria.
- Return valid = FALSE if the text is not speech-friendly and does not meet all the criteria.
- Return the reason for the validity of the text, be as detailed as possible but keep response under 900 tokens MAX.
- Do not include any other text in your response.
`;

const CorrectionSystemPrompt =
  SpeechFriendlySystemPrompt +
  `
- The first attempt had issues with the output according to the validator.
- See the validator's reason:\n{{validationErrorReasoning}}
- Correct the issue and return the corrected text.
- You must output ONLY the final corrected text.
- Do not include any other text in your response.
`;

export async function textToSpeech(text: string): Promise<GeneratedAudioFile> {
  const { audio } = await generateSpeech({
    model: openai.speech("gpt-4o-mini-tts"),
    text: text,
    voice: "alloy",
  });

  return audio;
}

export async function transformTextToSpeechFriendly(
  text: string
): Promise<string> {
  let result = text;

  const speechFriendlyTextStartGeneration = performance.now();

  const firstAttemptSpeechFriendlyTextStartGeneration = performance.now();
  const speechFriendlyText = await generateText({
    model: openai("gpt-5-nano"),
    system: SpeechFriendlySystemPrompt,
    prompt: text,
    temperature: 0,
    maxOutputTokens: GUARDRAIL_MAX_OUTPUT_TOKENS,
  });

  const firstAttemptSpeechFriendlyTextEndGeneration = performance.now();

  logger.log(
    "transformTextToSpeechFriendly",
    `First attempt speech-friendly text generation completed in ${firstAttemptSpeechFriendlyTextEndGeneration - firstAttemptSpeechFriendlyTextStartGeneration} milliseconds`
  );

  const validatedTranscriptStartGeneration = performance.now();
  const validatedTranscript = await generateObject({
    model: openai("gpt-5-nano"),
    system: ValidationSystemPrompt,
    prompt: `Original text: ${text}\n\nTransformed text: ${speechFriendlyText.text}`,
    temperature: 0,
    schema: ValidationSchema,
    maxOutputTokens: GUARDRAIL_MAX_OUTPUT_TOKENS,
  });
  const validatedTranscriptEndGeneration = performance.now();

  logger.log(
    "transformTextToSpeechFriendly",
    `Validated transcript generation completed in ${validatedTranscriptEndGeneration - validatedTranscriptStartGeneration} milliseconds`
  );

  recordLlmCall({
    model: "gpt-5-nano",
    usage: speechFriendlyText.usage,
    durationMs:
      firstAttemptSpeechFriendlyTextEndGeneration -
      firstAttemptSpeechFriendlyTextStartGeneration,
    metadata: { operation: "tts-speech-friendly-v1" },
  });

  recordLlmCall({
    model: "gpt-5-nano",
    usage: validatedTranscript.usage,
    durationMs:
      validatedTranscriptEndGeneration - validatedTranscriptStartGeneration,
    metadata: { operation: "tts-validate-v1" },
  });

  if (!validatedTranscript.object.valid) {
    // Try to regenerate text, use slightly stronger model
    const regeneratedTranscriptStartGeneration = performance.now();
    const regeneratedTranscript = await generateText({
      model: openai("gpt-5-mini"),
      system: CorrectionSystemPrompt.replace(
        "{{validationErrorReasoning}}",
        validatedTranscript.object.reason
      ),
      prompt: `Original text: ${text}\n\nTransformed text: ${speechFriendlyText.text}`,
      temperature: 0,
      maxOutputTokens: GUARDRAIL_MAX_OUTPUT_TOKENS,
    });
    const regeneratedTranscriptEndGeneration = performance.now();

    logger.log(
      "transformTextToSpeechFriendly",
      `Regenerated transcript generation completed in ${regeneratedTranscriptEndGeneration - regeneratedTranscriptStartGeneration} milliseconds`
    );

    recordLlmCall({
      model: "gpt-5-mini",
      usage: regeneratedTranscript.usage,
      durationMs:
        regeneratedTranscriptEndGeneration -
        regeneratedTranscriptStartGeneration,
      metadata: { operation: "tts-regenerate-v1" },
    });

    const betterVersionOfTranscriptStartGeneration = performance.now();
    const betterVersionOfTranscript = await generateObject({
      model: openai("gpt-5-nano"),
      system: `Based on the validation criteria, determine whether transcript A, B, or C is best. \nValidation criteria: ${ValidationCriteria}`,
      prompt: `Option A: ${text}\n\nOption B: ${speechFriendlyText.text}\n\nOption C: ${regeneratedTranscript.text}`,
      temperature: 0,
      schema: z.object({
        bestTranscript: z
          .enum(["A", "B", "C"])
          .describe("The best transcript based on the validation criteria"),
      }),
      maxOutputTokens: GUARDRAIL_MAX_OUTPUT_TOKENS,
    });
    const betterVersionOfTranscriptEndGeneration = performance.now();

    logger.log(
      "transformTextToSpeechFriendly",
      `Better version of transcript generation completed in ${betterVersionOfTranscriptEndGeneration - betterVersionOfTranscriptStartGeneration} milliseconds`
    );

    recordLlmCall({
      model: "gpt-5-nano",
      usage: betterVersionOfTranscript.usage,
      durationMs:
        betterVersionOfTranscriptEndGeneration -
        betterVersionOfTranscriptStartGeneration,
      metadata: { operation: "tts-compare-abc-v1" },
    });

    logger.log(
      "transformTextToSpeechFriendly",
      `Better version of transcript: ${betterVersionOfTranscript.object.bestTranscript}`
    );
    switch (betterVersionOfTranscript.object.bestTranscript) {
      case "A":
        break;
      case "B":
        result = speechFriendlyText.text;
        break;
      case "C":
        result = regeneratedTranscript.text;
        break;
    }
  } else {
    const betterVersionOfTranscriptStartGeneration = performance.now();
    const betterVersionOfTranscript = await generateObject({
      model: openai("gpt-5-nano"),
      system: `Based on the validation criteria, determine whether transcript A, B, or C is best. \nValidation criteria: ${ValidationCriteria}`,
      prompt: `Option A: ${text}\n\nOption B: ${speechFriendlyText.text}}`,
      temperature: 0,
      schema: z.object({
        bestTranscript: z
          .enum(["A", "B"])
          .describe("The best transcript based on the validation criteria"),
      }),
      maxOutputTokens: GUARDRAIL_MAX_OUTPUT_TOKENS,
    });
    const betterVersionOfTranscriptEndGeneration = performance.now();

    logger.log(
      "transformTextToSpeechFriendly",
      `Better version of transcript generation completed in ${betterVersionOfTranscriptEndGeneration - betterVersionOfTranscriptStartGeneration} milliseconds`
    );

    recordLlmCall({
      model: "gpt-5-nano",
      usage: betterVersionOfTranscript.usage,
      durationMs:
        betterVersionOfTranscriptEndGeneration -
        betterVersionOfTranscriptStartGeneration,
      metadata: { operation: "tts-compare-ab-v1" },
    });

    logger.log(
      "transformTextToSpeechFriendly",
      `Better version of transcript: ${betterVersionOfTranscript.object.bestTranscript}`
    );
    switch (betterVersionOfTranscript.object.bestTranscript) {
      case "A":
        break;
      case "B":
        result = speechFriendlyText.text;
        break;
    }
  }

  const speechFriendlyTextEndGeneration = performance.now();

  logger.log(
    "transformTextToSpeechFriendly",
    `Speech-friendly text generation completed in ${speechFriendlyTextEndGeneration - speechFriendlyTextStartGeneration} milliseconds`
  );

  return result;
}

const SpeechFriendlySystemPromptV2 = `
Developer: You are a helpful assistant that converts text into speech-friendly output and adds optional speech-control tags for better delivery.

Instructions:
- Only edit the text as needed to make it suitable for speech.
- If the text is already speech-friendly, return the text as is (you may still add a few tags for pace/breath).
- Describe visible elements (like code blocks, lists, images) for listener clarity.
- Output should closely match the original text in sequence.
- Convert special characters to be easy for speech.
- Ensure the result is ready for AI TTS audio generation and aligns with the input.

Speech-control tags (use sparingly; a downstream pipeline will interpret or strip them):
- <breath/> or <breath length="short|medium|long"/> — natural breath or micro-pause (e.g. between clauses, after a list item).
- <pause length="short|medium|long"/> — deliberate pause (e.g. before emphasis, after a heading, between sections).
- <pace speed="slower|normal|faster"/> — hint for speaking rate (e.g. <pace speed="slower"/> before important or complex phrases).
- <tone type="softer|emphatic|neutral|warm"/> — delivery hint (e.g. <tone type="softer"/> for asides, <tone type="emphatic"/> for key points).

Output ONLY the transformed text (including any tags). Do not include any other text in your response.
`;

const SpeechResultSchema = z.object({
  speechFriendlyText: z
    .string()
    .describe(
      "The speech-friendly text, optionally including speech-control tags: <breath/>, <pause length=\"short|medium|long\"/>, <pace speed=\"slower|normal|faster\"/>, <tone type=\"softer|emphatic|neutral|warm\"/>."
    ),
  grade: z
    .number()
    .describe(
      "Grade for the quality of the speech-friendly text. 100 is the highest grade."
    ),
  reason: z
    .string()
    .describe(
      "Reason for the grade. Be as detailed as possible but keep response under 300 tokens MAX."
    ),
});

export async function transformTextToSpeechFriendlyV2(
  text: string
): Promise<string> {
  // Check cache first
  const cacheKey = text.trim().toLowerCase();
  const cached = textCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    logger.log("transformTextToSpeechFriendlyV2", "Returning cached result");
    return cached.text;
  }

  const result = await generateObject({
    model: openai("gpt-5-nano"),
    system: SpeechFriendlySystemPromptV2,
    prompt: text,
    temperature: 0,
    schema: SpeechResultSchema,
    maxOutputTokens: GUARDRAIL_MAX_OUTPUT_TOKENS,
  });

  if (result.object.grade >= 80) {
    const finalResult = result.object.speechFriendlyText;
    textCache.set(cacheKey, { text: finalResult, timestamp: Date.now() });
    return finalResult;
  }

  const regeneratedTranscriptStartGeneration = performance.now();

  const regeneratedTranscript = await generateObject({
    model: openai("gpt-5-nano"),
    system: CorrectionSystemPrompt.replace(
      "{{validationErrorReasoning}}",
      result.object.reason
    ),
    prompt: `Original text: ${text}\n\nTransformed text: ${result.object.speechFriendlyText}`,
    temperature: 0,
    schema: SpeechResultSchema,
    maxOutputTokens: GUARDRAIL_MAX_OUTPUT_TOKENS,
  });

  const regeneratedTranscriptEndGeneration = performance.now();

  logger.log(
    "transformTextToSpeechFriendlyV2",
    `Regenerated transcript generation completed in ${regeneratedTranscriptEndGeneration - regeneratedTranscriptStartGeneration} milliseconds`
  );

  recordLlmCall({
    model: "gpt-5-nano",
    usage: result.usage,
    durationMs: 0,
    metadata: { operation: "tts-v2-initial" },
  });

  recordLlmCall({
    model: "gpt-5-nano",
    usage: regeneratedTranscript.usage,
    durationMs:
      regeneratedTranscriptEndGeneration - regeneratedTranscriptStartGeneration,
    metadata: { operation: "tts-v2-regenerate" },
  });

  let finalResult = text;

  if (regeneratedTranscript.object.grade >= result.object.grade) {
    finalResult = regeneratedTranscript.object.speechFriendlyText;
  } else {
    finalResult = result.object.speechFriendlyText;
  }
  textCache.set(cacheKey, { text: finalResult, timestamp: Date.now() });
  return finalResult;
}
