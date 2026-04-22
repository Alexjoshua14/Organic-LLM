import "server-only";

import { generateText } from "ai";

import { GUARDRAIL_MAX_OUTPUT_TOKENS } from "@/lib/llm/helpers";
import { recordLlmCall } from "@/lib/llm/metrics";
import { TITLE_PIPELINE_SUMMARIZER_MODEL } from "@/lib/llm/title-models";
import { STRATA_ELABORATED_SPEECH_SUMMARY_INPUT_MAX_CHARS } from "@/lib/strata/elaborated-tts";
import { isElevenLabsV3SpeechModelId } from "@/lib/tts/elevenlabs-v3-speech";
import { normalizeSummaryScriptWhitespace } from "@/lib/tts/strata-summary-script-format";
import type { Result } from "@/types";

const STRATA_ELABORATED_SPEECH_SUMMARY_SYSTEM_BASE = `
You write a single spoken paragraph for text-to-speech (no title, no lists, no markdown).
Given the user's elaborated document (plain text), produce a neutral summary they can listen to in about 22–28 seconds when read aloud (aim for roughly 55–70 words; stay within one paragraph).
Do not say you are summarizing; speak directly in third person or neutral expository voice about the content.
`.trim();

const STRATA_ELABORATED_SPEECH_SUMMARY_PLAIN_FOOTER =
  "Output plain words and punctuation only — no bracket tags, markup, or SSML.";

/**
 * Instructions for scripts sent to the expressive `eleven_v3` speech model: that stack treats certain
 * `[lowercase phrase]` segments as delivery hints (pauses, tone), not as words to read aloud.
 */
const STRATA_ELEVEN_V3_TAGGED_SPEECH_APPENDIX = `
The next synthesis step uses a speech model that accepts **inline performance tags**: a left square bracket, a short lowercase cue, a right square bracket — for example [pause], [calmly], [thoughtful], [whispers], [sighs]. Place them **inline** where a human narrator might breathe, shift tone, or pause between ideas.

Use **3–7 tags total** across the whole script. Prefer **[pause]** between clauses or after a dense phrase; optional light delivery cues like **[calmly]** or **[thoughtful]** once if they help the opening or a pivot. Lean on **normal punctuation** (commas, periods, occasional ellipses) for most rhythm.

**Syntax rules:** each tag is exactly \`[\` + lowercase letters (and spaces only if the cue is naturally multi-word, e.g. [matter of fact]) + \`]\`; no nesting; no digits-only cues; do not invent long novel phrases inside brackets.

**Do not** use SSML, HTML, angle-bracket tags, markdown, lists, or headings — only running prose plus these bracket tags. Tags are for the synthesizer, not for the listener to hear as literal words, so keep wording outside brackets fluent.

Stay within the same word-count target; bracket tags count lightly toward length.
`.trim();

function buildSpeechSummarySystem(ttsModelId: string | undefined | null): string {
  if (isElevenLabsV3SpeechModelId(ttsModelId)) {
    return `${STRATA_ELABORATED_SPEECH_SUMMARY_SYSTEM_BASE}\n\n${STRATA_ELEVEN_V3_TAGGED_SPEECH_APPENDIX}`;
  }
  return `${STRATA_ELABORATED_SPEECH_SUMMARY_SYSTEM_BASE}\n\n${STRATA_ELABORATED_SPEECH_SUMMARY_PLAIN_FOOTER}`;
}

function clampInputForSummarizer(plain: string): string {
  const t = plain.trim();
  if (t.length <= STRATA_ELABORATED_SPEECH_SUMMARY_INPUT_MAX_CHARS) return t;
  return t.slice(0, STRATA_ELABORATED_SPEECH_SUMMARY_INPUT_MAX_CHARS);
}

export async function generateStrataElaboratedSpeechSummaryScript(options: {
  elaboratedPlain: string;
  contextId?: string;
  /** When this is Eleven v3, the script may include ElevenLabs v3 square-bracket audio tags for pacing. */
  ttsModelId?: string | null;
}): Promise<Result<string>> {
  const input = clampInputForSummarizer(options.elaboratedPlain);
  if (!input) {
    return { data: null, error: new Error("No elaborated text to summarize") };
  }

  const start = performance.now();
  try {
    const result = await generateText({
      model: TITLE_PIPELINE_SUMMARIZER_MODEL,
      system: buildSpeechSummarySystem(options.ttsModelId),
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

    const script = normalizeSummaryScriptWhitespace(result.text ?? "");
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
