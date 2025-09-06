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

const logger = createLogger("lib/llm/text-to-speech.ts");

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
  });
  const validatedTranscriptEndGeneration = performance.now();
  logger.log(
    "transformTextToSpeechFriendly",
    `Validated transcript generation completed in ${validatedTranscriptEndGeneration - validatedTranscriptStartGeneration} milliseconds`
  );

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
    });
    const regeneratedTranscriptEndGeneration = performance.now();
    logger.log(
      "transformTextToSpeechFriendly",
      `Regenerated transcript generation completed in ${regeneratedTranscriptEndGeneration - regeneratedTranscriptStartGeneration} milliseconds`
    );

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
    });
    const betterVersionOfTranscriptEndGeneration = performance.now();
    logger.log(
      "transformTextToSpeechFriendly",
      `Better version of transcript generation completed in ${betterVersionOfTranscriptEndGeneration - betterVersionOfTranscriptStartGeneration} milliseconds`
    );

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
    });
    const betterVersionOfTranscriptEndGeneration = performance.now();
    logger.log(
      "transformTextToSpeechFriendly",
      `Better version of transcript generation completed in ${betterVersionOfTranscriptEndGeneration - betterVersionOfTranscriptStartGeneration} milliseconds`
    );

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
