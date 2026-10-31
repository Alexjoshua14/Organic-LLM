import type { JevAnalysis, JevPlan, JevResponseFormat } from "@/lib/arcadia/jev/types";

import { JEV_INTENT_MIN_CONFIDENCE } from "@/lib/arcadia/jev/constants";
import { JEV_INTENTS, JEV_RESPONSE_FORMAT_LABELS, JEV_TOOLS } from "@/lib/arcadia/jev/questions";
import { JEV_TOOL_KEYS } from "@/lib/arcadia/jev/types";
import { VOICE_REPLY_MAX_SECONDS, VOICE_REPLY_MAX_WORDS } from "@/lib/arcadia/jev/voice";
import { VOICE_REPLY_TOOL_NAME } from "@/lib/schemas/jev-tools";

/**
 * System prompt augmentation for the Arcadia "Jev" chat style. Jev reads each user message
 * before the LLM does; this tells the LLM what Jev concluded and which tools and reply format the
 * server set up as a result. Appended last in the Arcadia block, after the length guidance, so
 * the voice and tool-result rules win over it.
 */

/** A one-line label is all the text a tool-only reply carries; past this it reads as prose. */
const TOOL_RESULT_LABEL_MAX_WORDS = 12;

/** Predefined voice-reply prompt. The tool and the player enforce the same cap. */
export const JEV_VOICE_REPLY_INSTRUCTIONS = [
  "[Jev — voice reply]",
  `The user wants to hear this reply. Deliver it by calling ${VOICE_REPLY_TOOL_NAME} exactly once, as your last action, after any other tools you need. The app plays your script in an audio player in the chat.`,
  `- Hard limit: ${VOICE_REPLY_MAX_SECONDS} seconds of speech, about ${VOICE_REPLY_MAX_WORDS} words. Anything longer is cut off, so say what matters most first.`,
  '- Write for the ear: plain conversational sentences with contractions. No markdown, lists, headings, emoji, URLs, or code. Say symbols, numbers, and abbreviations the way you would speak them ("forty percent", "three to five", "for example").',
  '- Put anything that must be read rather than heard (code, a link, an exact figure or address) in onScreen as short markdown, and point to it in the script ("the link is below").',
  `- Write no other text: no preamble before ${VOICE_REPLY_TOOL_NAME} and no recap after it. The player is the whole reply.`,
  `- Don't use render_gen_ui's audio-snippet block; ${VOICE_REPLY_TOOL_NAME} is how this reply is spoken.`,
  "- These rules override any other reply-length or formatting guidance in this prompt.",
].join("\n");

/** Predefined tool-result prompt: the reply is the artifact, not prose about it. */
export const JEV_TOOL_RESULT_INSTRUCTIONS = [
  "[Jev — tool result only]",
  "The user wants the artifact itself, not prose about it. Call the tool or tools that produce it, then stop.",
  `- Write at most one short line of text (under ${TOOL_RESULT_LABEL_MAX_WORDS} words), and only as a label for the result, e.g. "Checkout flow, end to end." No introduction, explanation, recap, or follow-up offer.`,
  "- Don't repeat in text what the tool output already shows.",
  "- If none of your tools can produce what was asked, say so in one line instead.",
  "- These rules override any other reply-length or formatting guidance in this prompt.",
].join("\n");

const FORMAT_HINTS: Record<JevResponseFormat, string> = {
  text: "a normal written reply.",
  voice: `deliver it with ${VOICE_REPLY_TOOL_NAME} (rules below).`,
  tool_result: "the tool output alone (rules below).",
};

function intentLine(intent: JevAnalysis["intent"]): string {
  const definition = intent ? JEV_INTENTS[intent.choice] : undefined;

  // `!(x >= min)` also treats a NaN confidence as unclear.
  if (!intent || !definition || !(intent.confidence >= JEV_INTENT_MIN_CONFIDENCE)) {
    return "- Intent: unclear — use your judgment.";
  }

  const percent = Math.round(intent.confidence * 100);

  return `- Intent: ${definition.label} (${percent}% confidence). ${definition.guidance}`;
}

function toolsLine(tools: JevPlan["tools"]): string {
  // Canonical order (and no duplicates) whatever order the plan listed them in.
  const labels = JEV_TOOL_KEYS.filter((key) => tools.includes(key)).map(
    (key) => JEV_TOOLS[key].label
  );

  return `- Tools enabled for this turn: ${labels.length ? labels.join(", ") : "none"}. Tools you don't have were switched off on purpose — don't offer them.`;
}

/**
 * The per-turn Jev section of the system prompt. Built from Jev's analysis and the server's plan
 * only — never from the message itself — so it carries no user content.
 */
export function buildJevSystemFragment(params: { analysis: JevAnalysis; plan: JevPlan }): string {
  const { analysis, plan } = params;
  const format = plan.responseFormat;

  const lines = [
    "Jev, a decision model, read the user's latest message before you did and set up this turn. Use this to shape your reply; don't mention the setup unless the user asks about it.",
    intentLine(analysis.intent),
    toolsLine(plan.tools),
    `- Reply format: ${JEV_RESPONSE_FORMAT_LABELS[format]} — ${FORMAT_HINTS[format]}`,
  ];

  if (plan.override) {
    lines.push(
      "- The user asked for a reply after Jev judged none was needed — answer fully."
    );
  }

  if (analysis.source === "fallback") {
    lines.push(
      "- Jev couldn't read this message, so this turn uses the standard Arcadia setup."
    );
  }

  let out = `\n\n[Jev — message preprocessing]\n${lines.join("\n")}`;

  if (format === "voice") {
    out += `\n\n${JEV_VOICE_REPLY_INSTRUCTIONS}`;
  } else if (format === "tool_result") {
    out += `\n\n${JEV_TOOL_RESULT_INSTRUCTIONS}`;
  }

  return out;
}
