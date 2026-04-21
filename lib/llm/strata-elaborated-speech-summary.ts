import "server-only";

import { generateText } from "ai";

import { GUARDRAIL_MAX_OUTPUT_TOKENS } from "@/lib/llm/helpers";
import { recordLlmCall } from "@/lib/llm/metrics";
import { TITLE_PIPELINE_SUMMARIZER_MODEL } from "@/lib/llm/title-models";
import { STRATA_ELABORATED_SPEECH_SUMMARY_INPUT_MAX_CHARS } from "@/lib/strata/elaborated-tts";
import type { Result } from "@/types";

const STRATA_ELABORATED_SPEECH_SUMMARY_SYSTEM = `
You write a single spoken paragraph for text-to-speech (no title, no lists, no markdown).
Given the user's elaborated document (plain text), produce a neutral summary they can listen to in about 22–28 seconds when read aloud (aim for roughly 55–70 words; stay within one paragraph).
Do not say you are summarizing; speak directly in third person or neutral expository voice about the content.
Output plain text only.
`.trim();

function clampInputForSummarizer(plain: string): string {
  const t = plain.trim();
  if (t.length <= STRATA_ELABORATED_SPEECH_SUMMARY_INPUT_MAX_CHARS) return t;
  return t.slice(0, STRATA_ELABORATED_SPEECH_SUMMARY_INPUT_MAX_CHARS);
}

export async function generateStrataElaboratedSpeechSummaryScript(options: {
  elaboratedPlain: string;
  contextId?: string;
}): Promise<Result<string>> {
  const input = clampInputForSummarizer(options.elaboratedPlain);
  if (!input) {
    return { data: null, error: new Error("No elaborated text to summarize") };
  }

  const start = performance.now();
  try {
    const result = await generateText({
      model: TITLE_PIPELINE_SUMMARIZER_MODEL,
      system: STRATA_ELABORATED_SPEECH_SUMMARY_SYSTEM,
      prompt: input,
      maxOutputTokens: GUARDRAIL_MAX_OUTPUT_TOKENS,
    });
    const durationMs = performance.now() - start;

    recordLlmCall({
      model: TITLE_PIPELINE_SUMMARIZER_MODEL as string,
      usage: result.usage,
      durationMs,
      metadata: {
        operation: "strataElaboratedSpeechSummary",
        contextId: options.contextId,
      },
    });

    const script = (result.text ?? "").replace(/\s+/g, " ").trim();
    if (!script) {
      return { data: null, error: new Error("Summary script was empty") };
    }
    return { data: script, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}
