/**
 * Time trials for LLMs
 *
 * Tests the response speeds for different prompts, settings, etc, for specific functions
 */

import { createLogger } from "@/lib/logger";

const logger = createLogger("tests/time-trials/llms.ts");

import {
  transformTextToSpeechFriendly,
  transformTextToSpeechFriendlyV2,
} from "@/lib/llm/text-to-speech";

/**
 * Text to Speech Friendly Transformation
 */

export const textToSpeechFriendlyTransformationTimeTrial = async () => {
  logger.log(
    "textToSpeechFriendlyTransformationTimeTrial",
    "\n\n########################################################\nStarting time trial for text to speech friendly transformation\n########################################################\n"
  );
  const timeTrialStart = performance.now();

  const inputText = `
          Here’s the test output: short text, a code block, and a simple mermaid diagram.

          **Short text:**
          This is a quick test response containing a small code snippet and a mermaid diagram showing the "quick test" flow.

          **Code block:**
          \`\`\`javascript
          // quickTest.js
          function quickTest() {
            const input = "quick test";
            console.log("Input:", input);
            // Expected assistant behavior: reply <= 150 tokens
            return "OK — short response (<=150 tokens)";
          }

          if (require.main === module) {
            console.log(quickTest());
          }
          \`\`\`

          **Mermaid diagram:**
          \`\`\`mermaid
          flowchart LR
            U[User] -->|"quick test"| A[Assistant]
            A -->|reply ≤150 tokens| R[Response]
          \`\`\`
          `;

  const ttsFriendlyTextv1StartGeneration = performance.now();
  const ttsFriendlyTextv1 = await transformTextToSpeechFriendly(inputText);
  const ttsFriendlyTextv1EndGeneration = performance.now();

  const ttsFriendlyTextv2StartGeneration = performance.now();
  const ttsFriendlyTextv2 = await transformTextToSpeechFriendlyV2(inputText);
  const ttsFriendlyTextv2EndGeneration = performance.now();

  const timeTrialEnd = performance.now();

  logger.log(
    `textToSpeechFriendlyTransformationTimeTrial`,
    `Time Trials comparing v1 and v2 for text to speech friendly transformation`
  );
  logger.log(
    "textToSpeechFriendlyTransformationTimeTrial",
    `v1 generation time: ${ttsFriendlyTextv1EndGeneration - ttsFriendlyTextv1StartGeneration} milliseconds`
  );
  logger.log(
    "textToSpeechFriendlyTransformationTimeTrial",
    `v2 generation time: ${ttsFriendlyTextv2EndGeneration - ttsFriendlyTextv2StartGeneration} milliseconds`
  );
  logger.log(
    "textToSpeechFriendlyTransformationTimeTrial",
    `Time trial completed total time: ${timeTrialEnd - timeTrialStart} milliseconds`
  );
};
